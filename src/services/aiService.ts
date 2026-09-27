import { UserPreferences } from '../context/AppContext';
import { supabase } from './supabase';

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
  } catch (err) {
    console.error("JSON Parse Hatası. Ham metin:", text);
    return null;
  }
};

// Edge Function'dan gelen yanıtı her ihtimale karşı güvenli ayıklama
const extractResponseText = (data: any): string | null => {
  if (!data) return null;
  // 1. Supabase Function doğrudan string döndüyse
  if (typeof data === 'string') return data;
  // 2. Google Gemini standart candidates yapısı
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }
  // 3. Düz text alanı varsa
  if (data?.text) return data.text;
  // 4. Eğer data doğrudan nesneyse ve içinde text varsa
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  
  // Hiçbiri tutmazsa stringe çevirip denetelim
  try {
    return JSON.stringify(data);
  } catch (e) {
    return null;
  }
};

// 1. AI Tarif Üretici
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

    const textResponse = extractResponseText(data);
    if (textResponse) {
      return safeJsonParse(textResponse);
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
  } catch (error) {
    console.error("Gemini Vision Tarama Hatası:", error);
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
      '2. Adım metnindeki anlatımı profesyonel ve sıralı adımlar haline getir.\n' +
      '3. SADECE geçerli bir JSON objesi ver.\n\n' +
      'İSTENEN JSON FORMATI:\n' +
      '{\n' +
      '  "title": "Düzeltilmiş Başlık",\n' +
      '  "mainIngredient": "En belirgin 1 ana malzeme",\n' +
      '  "ingredients": ["Yumurta", "Süt", "Un"],\n' +
      '  "ingredientsWithQuantities": ["2 adet Yumurta", "1 su bardağı Süt", "2 su bardağı Un"],\n' +
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
      console.warn("⚠️ AI Yanıt vermedi veya metin çıkarılamadı. Ham data:", data);
      return null;
    }

    const parsedResult = safeJsonParse(textResponse);

    return parsedResult;

  } catch (error) {
    console.error("❌ YAKALANAN HATA (Catch):", error);
    return null;
  }
};