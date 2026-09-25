import { UserPreferences } from '../context/AppContext';
import { supabase } from './supabase'; // Supabase istemcinin olduğu dosya

export interface AIRecipeResult {
  title: string;
  cookingTime: string;
  mainIngredient: string;
  ingredientsWithQuantities: string[];
  missingIngredients: string[];
  instructions: string[];
}

export interface ScannedItem {
  name: string;
  brand?: string;
  quantity: string;
  expiryDate: string; // "DD-MM-YYYY" formatında
}

export interface UserRecipeInput {
  title: string;
  category: string;
  cookingTime: string;
  servings: string;
  rawIngredients: string;
  rawInstructions: string;
}

// 1. AI Tarif Üretici (Supabase Edge Function üzerinden)
export const generateRecipeWithAI = async (
  ingredients: string[], 
  preferences?: UserPreferences,
  category: string = 'Fit & Sağlıklı'
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

  const prompt = `Sen uzman bir şefsin. Elimizdeki mutfak malzemeleri şunlar: ${ingredients.join(', ')}. ${preferenceRules}
Özellikle şu kategoriye ve tarza odaklanarak bir tarif üret: ${category}.
Bu bilgilere uygun pratik ve lezzetli bir tarif öner.

Cevabını SADECE geçerli bir JSON nesnesi olarak döndür. Başka hiçbir açıklama yazma.
Format şu şekilde olsun:
{
  "title": "Yemek Adı",
  "cookingTime": "20 Dk",
  "mainIngredient": "Ana Malzeme Adı",
  "ingredientsWithQuantities": [
    "200g Taze Kaşar Peyniri",
    "2 Dilim Somun Ekmek"
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

    // Supabase Edge Function'dan dönen Gemini yanıtını işliyoruz
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text;
    if (textResponse) {
      const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString);
    }
  } catch (error) {
    console.error("AI Tarif Hatası:", error);
  }
  return null;
};

// 2. Gemini Vision ile Fiş / Ürün Fotoğrafı Taraması
export const scanImageWithAI = async (base64Image: string): Promise<ScannedItem[] | null> => {
  const prompt = `Sen bir mutfak ve envanter asistanısın. Gönderilen bu fotoğraf bir market fişi, gıda ambalajı veya barkodlu bir ürün olabilir.
Fotoğraftaki gıda/mutfak ürünlerini tespit et.

Her ürün için:
1. "name": Ürün adı (Örn: Tam Yağlı Süt)
2. "brand": Ürün markası (eğer görünüyorsa, yoksa "Genel")
3. "quantity": Miktarı/Ağırlığı (Örn: 1 Litre, 500 Gram, 2 Adet)
4. "expiryDate": Eğer ambalajda/fişte SKT tarihi varsa "DD-MM-YYYY" (Örn: "25-10-2026") formatında yaz. Görünmüyorsa ürünün yapısına uygun mantıklı bir gelecek tarih ver (Sebze için 7 gün, süt ürünü için 15 gün, bakliyat için 1 yıl sonrası).

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

    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text;
    if (textResponse) {
      const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString);
    }
  } catch (error) {
    console.error("Gemini Vision Tarama Hatası:", error);
  }
  return null;
};

// 3. Kullanıcı Tarifini Biçimlendirme
export const formatUserRecipeWithAI = async (input: UserRecipeInput) => {
  try {
    const prompt = 'Sen profesyonel bir sefsin. Sana verilen duzensiz veya hatali yemek tarifini analiz edip standart bir formata getireceksin.\n\n' +
      'KULLANICI GIRDI LER I:\n' +
      '- Baslik: ' + input.title + '\n' +
      '- Kategori: ' + input.category + '\n' +
      '- Sure: ' + input.cookingTime + '\n' +
      '- Girilen Malzeme Metni: "' + input.rawIngredients + '"\n' +
      '- Girilen Adim Metni: "' + input.rawInstructions + '"\n\n' +
      'GOREVLERIN:\n' +
      '1. Malzeme metnindeki tum malzemeleri ve miktarlari ayristirip duzelt.\n' +
      '2. Adim metnindeki anlatimi profesyonel ve sirali adimlar haline getir.\n' +
      '3. SADECE gecerli bir JSON objesi ver.\n\n' +
      'ISTENEN JSON FORMATI:\n' +
      '{\n' +
      '  "title": "Duzeltilmis Baslik",\n' +
      '  "mainIngredient": "En belirgin 1 ana malzeme",\n' +
      '  "ingredients": ["Yumurta", "SUT", "Un"],\n' +
      '  "ingredientsWithQuantities": ["2 adet Yumurta", "1 su bardagi SUT", "2 su bardagi Un"],\n' +
      '  "cookingTime": "' + (input.cookingTime || '25 Dk') + '",\n' +
      '  "instructions": [\n' +
      '    "1. Yumurtalari mikser ile iyice cirpin.",\n' +
      '    "2. Sutu ekleyip karistirin.",\n' +
      '    "3. Unu ekleyerek homojen bir hamur elde edin."\n' +
      '  ]\n' +
      '}';

    const { data, error } = await supabase.functions.invoke('generate-recipe', {
      body: { prompt },
    });

    if (error) throw error;

    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text;
    if (!textResponse) {
      console.warn("AI Yanit vermedi");
      return null;
    }

    const cleanText = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);

  } catch (error) {
    console.error("AI Tarif formatlama hatasi:", error);
    return null;
  }
};