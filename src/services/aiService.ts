import { UserPreferences } from '../context/AppContext';
import { supabase } from './supabase';

export interface AIRecipeResult {
  title: string;
  cookingTime: string;
  mainIngredient: string;
  ingredientsWithQuantities: {
    name: string;
    amount: number;
    unit: string;
  }[];
  missingIngredients: string[];
  instructions: string[];
}

export interface ScannedItem {
  name: string;
  brand?: string;
  quantity: string;
  expiryDate: string;
}

export interface UserRecipeInput {
  title: string;
  category: string;
  cookingTime: string;
  servings: string;
  rawIngredients: string;
  rawInstructions: string;
}

// Metin içindeki miktarı, birimi ve saf ürün adını akıllıca ayrıştıran yardımcı fonksiyon
const parseIngredientString = (rawName: string) => {
  if (!rawName) return { name: 'Malzeme', amount: 1, unit: 'adet' };

  let text = rawName.trim();
  let amount = 1;
  let unit = 'adet';

  // 1. Parantez içindeki gramaj/ml ifadelerini yakalayalım (Örn: "1 paket (500 g) Makarna")
  const parenMatch = text.match(/\((\d+[\.,]?\d*)\s*(g\vert{}gram\vert{}ml\vert{}kg\vert{}litre\vert{}lt)\)/i);
  if (parenMatch) {
    amount = parseFloat(parenMatch[1].replace(',', '.'));
    unit = parenMatch[2].toLowerCase();
    if (unit === 'g') unit = 'gram';
    if (unit === 'lt') unit = 'litre';
    text = text.replace(/\([\s\S]*?\)/g, '').trim();
  }

  // 2. Baş taraftaki sayı ve birimleri yakalayalım (Örn: "2.5 litre Su", "200g Peynir")
  const regex = /^(\d+[\.,]?\d*)\s*(g|gram|ml|kg|litre|lt|adet|paket|su bardağı|yemek kaşığı|çay kaşığı|diş|demet|tutam|bardak)?\s+(.+)/i;
  const match = text.match(regex);

  if (match) {
    if (!parenMatch) {
      amount = parseFloat(match[1].replace(',', '.'));
    }
    if (match[2] && !parenMatch) {
      unit = match[2].toLowerCase();
      if (unit === 'g') unit = 'gram';
      if (unit === 'lt') unit = 'litre';
    }
    text = match[3].trim();
  }

  return {
    name: text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1),
    amount: isNaN(amount) ? 1 : amount,
    unit: unit || 'adet'
  };
};

// Güvenli JSON Ayıklama Yardımcı Fonksiyonu
const safeJsonParse = (text: string) => {
  try {
    const cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonStartIndex = cleanedText.indexOf('{') !== -1 ? cleanedText.indexOf('{') : cleanedText.indexOf('[');
    const jsonEndIndex = cleanedText.lastIndexOf('}') !== -1 ? cleanedText.lastIndexOf('}') : cleanedText.lastIndexOf(']');
    
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      const jsonString = cleanedText.substring(jsonStartIndex, jsonEndIndex + 1);
      return JSON.parse(jsonString);
    }
    return JSON.parse(cleanedText);
  } catch {
    return null;
  }
};

// Edge Function'dan gelen yanıtı her ihtimale karşı güvenli ayıklama (any kaldırıldı, unknown kullanıldı)
const extractResponseText = (data: unknown): string | null => {
  if (!data) return null;
  if (typeof data === 'string') return data;
  
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    
    // Supabase invoke yanıt yapısı kontrolü
    if (
      Array.isArray(record.candidates) &&
      record.candidates[0] &&
      typeof record.candidates[0] === 'object' &&
      record.candidates[0] !== null
    ) {
      const candidate = record.candidates[0] as Record<string, unknown>;
      if (
        candidate.content &&
        typeof candidate.content === 'object' &&
        candidate.content !== null
      ) {
        const content = candidate.content as Record<string, unknown>;
        if (Array.isArray(content.parts) && content.parts[0] && typeof content.parts[0] === 'object' && content.parts[0] !== null) {
          const part = content.parts[0] as Record<string, unknown>;
          if (typeof part.text === 'string') return part.text;
        }
      }
    }

    if (typeof record.text === 'string') return record.text;

    if (
      Array.isArray(record.choices) &&
      record.choices[0] &&
      typeof record.choices[0] === 'object' &&
      record.choices[0] !== null
    ) {
      const choice = record.choices[0] as Record<string, unknown>;
      if (choice.message && typeof choice.message === 'object' && choice.message !== null) {
        const message = choice.message as Record<string, unknown>;
        if (typeof message.content === 'string') return message.content;
      }
    }
  }
  
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
};

// 1. AI Tarif Üretici
export const generateRecipeWithAI = async (
  ingredients: string[], 
  preferences?: UserPreferences,
  category: string = 'Fit & Sağlıklı',
  ingredientMode: 'complete' | 'missing' | 'free' = 'free'
): Promise<AIRecipeResult | null> => {
  if (!ingredients || ingredients.length === 0) return null;

  let preferenceRules = "";
  if (preferences) {
    if (preferences.diets.length > 0) {
      preferenceRules += `\nKullanıcının Diyet Tercihleri: ${preferences.diets.join(', ')}. Tarif KESİNLİKLE bu diyet kurallarına uygun olmalıdır.`;
    }
    if (preferences.allergens.length > 0) {
      preferenceRules += `\nKullanıcının Alerjen/Hassasiyet Sınırları: ${preferences.allergens.join(', ')}. Tarif KESİNLİKLE bu alerjen maddeleri İÇERMEMELİDİR.`;
    }
  }

  let modeInstruction = "";
  if (ingredientMode === 'complete') {
    modeInstruction = "ÖNEMLİ KURAL: Yalnızca yukarıda verilen mevcut malzemeleri kullanarak (ekstra market malzemesi eklemeden) bir tarif üret.";
  } else if (ingredientMode === 'missing') {
    modeInstruction = "ÖNEMLİ KURAL: Mevcut malzemeleri temel al, ancak lezzet veya bütünlük için eksik kalan birkaç temel malzemeyi 'missingIngredients' listesine ekleyebilirsin.";
  } else {
    modeInstruction = "ÖNEMLİ KURAL: Serbest moddasın, dolaptakileri değerlendirirken dışarıdan ek malzemeler de ekleyebilirsin.";
  }

  const prompt = `Sen uzman bir şefsin. Elimizdeki mutfak malzemeleri şunlar: ${ingredients.join(', ')}. ${preferenceRules}
Özellikle şu kategoriye ve tarza odaklanarak bir tarif üret: ${category}.
${modeInstruction}
Bu bilgilere uygun pratik ve lezzetli bir tarif öner.

KRİTİK BİRİM KURALI: Tarif içerisinde "çay kaşığı", "tatlı kaşığı" veya "yemek kaşığı" gibi kaşık ölçüleri geçtiğinde, bunları birim olarak ASLA kullanma. Envanter düşüşlerinin gram/ml bazlı yapılabilmesi için bunları standart mutfak karşılıklarına göre gram ("gram") veya mililitreye ("ml") çevirerek yaz (Örn: 1 yemek kaşığı tereyağı/yağ = 15 gram/ml, 1 tatlı kaşığı tuz/şeker = 5 gram, 1 çay kaşığı baharat = 3 gram).

Cevabını SADECE geçerli bir JSON nesnesi olarak döndür. Başka hiçbir açıklama yazma.
Format şu şekilde olsun:
{
  "title": "Yemek Adı",
  "cookingTime": "20 Dk",
  "mainIngredient": "Ana Malzeme Adı",
  "ingredientsWithQuantities": [
    "200 gram Taze Kaşar Peyniri",
    "15 gram Tuz"
  ],
  "missingIngredients": ["Ekmek"],
  "instructions": [
    "1. Adım açıklaması",
    "2. Adım açıklaması"
  ]
}`;

  try {
    const { data, error } = await supabase.functions.invoke('generate-recipe', {
      body: { prompt },
    });

    if (error) throw error;

    const textResponse = extractResponseText(data);
    if (textResponse) {
      const parsed = safeJsonParse(textResponse);
      if (parsed && Array.isArray(parsed.ingredientsWithQuantities)) {
        parsed.ingredientsWithQuantities = parsed.ingredientsWithQuantities.map((item: unknown) => {
          if (typeof item === 'string') return parseIngredientString(item);
          if (typeof item === 'object' && item !== null) {
            return item;
          }
          return { name: String(item), amount: 1, unit: 'adet' };
        });
      }
      return parsed;
    }
  } catch {
    // Hata durumunda sessizce çıkılır
  }
  return null;
};

// 2. Gemini Vision ile Fiş / Ürün Fotoğrafı Taraması
export const scanImageWithAI = async (base64Image: string): Promise<ScannedItem[] | null> => {
  const prompt = `Sen bir mutfak ve envanter asistanısın. Gönderilen bu fotoğraf bir market fişi, gıda ambalajı veya barkodlu bir ürün olabilir.
Fotoğraftaki gıda/mutfak ürünlerini tespit et.

Her ürün için:
1. "name": Ürün adı
2. "brand": Ürün markası (yoksa "Genel")
3. "quantity": Miktarı/Ağırlığı
4. "expiryDate": SKT tarihi "DD-MM-YYYY" formatında. Görünmüyorsa mantıklı bir gelecek tarih ver.

Cevabını SADECE geçerli bir JSON dizisi (Array) olarak döndür. Başka hiçbir metin yazma.
Örnek format:
[
  {
    "name": "Tam Yağlı Süt",
    "brand": "Sütaş",
    "quantity": "1 Litre",
    "expiryDate": "25-10-2026"
  }
]`;

  try {
    const { data, error } = await supabase.functions.invoke('generate-recipe', {
      body: { 
        prompt: prompt,
        base64Image: base64Image 
      },
    });

    if (error) throw error;

    const textResponse = extractResponseText(data);
    if (textResponse) {
      return safeJsonParse(textResponse);
    }
  } catch {
    // Hata durumunda sessizce çıkılır
  }
  return null;
};

// 3. Kullanıcı Tarifini Biçimlendirme
export const formatUserRecipeWithAI = async (input: UserRecipeInput) => {
  try {
    const prompt = 'Sen profesyonel bir şefsin. Sana verilen düzensiz veya hatalı yemek tarifini analiz edip standart bir formata getireceksin.\n\n' +
      'KULLANICI GİRDİLERİ:\n' +
      '- Başlık: ' + input.title + '\n' +
      '- Kategori: ' + input.category + '\n' +
      '- Süre: ' + input.cookingTime + '\n' +
      '- Girilen Malzeme Metni: "' + input.rawIngredients + '"\n' +
      '- Girilen Adım Metni: "' + input.rawInstructions + '"\n\n' +
      'GÖREVLERİN:\n' +
      '1. Malzeme metnindeki tüm malzemeleri ve miktarları ayrıştırıp düzelt.\n' +
      '2. KRİTİK KURAL: Malzeme metninde "çay kaşığı", "tatlı kaşığı" veya "yemek kaşığı" geçiyorsa, bunları birim olarak ASLA kullanma. Envanter düşüşlerinin gram/ml bazlı yapılabilmesi için bunları mutfak standartlarına göre gram ("gram") veya mililitreye ("ml") çevirerek yaz (Örn: 1 yemek kaşığı tereyağı = 15 gram, 1 tatlı kaşığı tuz = 5 gram).\n' +
      '3. Adım metnindeki anlatımı profesyonel ve sıralı adımlar haline getir.\n' +
      '4. SADECE geçerli bir JSON objesi ver.\n\n' +
      'İSTENEN JSON FORMATI:\n' +
      '{\n' +
      '  "title": "Düzeltilmiş Başlık",\n' +
      '  "mainIngredient": "En belirgin 1 ana malzeme",\n' +
      '  "ingredients": ["Yumurta", "Süt", "Un"],\n' +
      '  "ingredientsWithQuantities": ["2 adet Yumurta", "200 ml Süt", "15 gram Tuz"],\n' +
      '  "cookingTime": "' + (input.cookingTime || '25 Dk') + '",\n' +
      '  "instructions": [\n' +
      '    "1. Yumurtaları mikser ile iyice çırpın.",\n' +
      '    "2. Sütü ekleyip karıştırın.",\n' +
      '    "3. Unu ekleyerek homojen bir hamur elde edin."\n' +
      '  ]\n' +
      '}';

    const { data, error } = await supabase.functions.invoke('generate-recipe', {
      body: { prompt },
    });

    if (error) throw error;

    const textResponse = extractResponseText(data);

    if (!textResponse) {
      return null;
    }

    const parsedResult = safeJsonParse(textResponse);

    if (parsedResult && Array.isArray(parsedResult.ingredientsWithQuantities)) {
      parsedResult.ingredientsWithQuantities = parsedResult.ingredientsWithQuantities.map((item: unknown) => {
        if (typeof item === 'string') return parseIngredientString(item);
        if (typeof item === 'object' && item !== null) {
          return item;
        }
        return { name: String(item), amount: 1, unit: 'adet' };
      });
    }

    return parsedResult;

  } catch {
    return null;
  }
};