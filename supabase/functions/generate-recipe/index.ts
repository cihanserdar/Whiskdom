import { createClient } from "@supabase/supabase-js";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface RequestPayload {
  prompt?: string;
  base64Image?: string;
  feature?: string; // 'aiRecipe' veya 'receipt'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Yetkilendirme tokenı bulunamadı.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz veya süresi dolmuş oturum.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // İstek gövdesini alarak hangi özelliğin çağrıldığını öğreniyoruz
    const requestBody: RequestPayload = await req.json().catch(() => ({}));
    const { prompt, base64Image, feature } = requestBody;
    const targetFeature = feature === 'receipt' ? 'receipt' : 'aiRecipe';

    // Güvenli kota kontrolü ve düşürme (Her iki olası RPC parametre imzasını da destekler)
    let quotaResult: any = null;
    let quotaError: any = null;

    const res1 = await supabaseClient.rpc('consume_quota_safely', {
      p_user_id: user.id,
      p_feature: targetFeature
    });

    if (!res1.error) {
      quotaResult = res1.data;
    } else {
      const res2 = await supabaseClient.rpc('consume_quota_safely', {
        feature_type: targetFeature
      });
      quotaResult = res2.data;
      quotaError = res2.error;
    }

    if (quotaError || !quotaResult?.allowed) {
      return new Response(JSON.stringify({ 
        error: quotaError?.message || 'Günlük kullanım hakkınız doldu.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY ortam değişkeni bulunamadı!');
    }

    let contents: GeminiContent[] = [];

    if (base64Image) {
      contents = [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            },
            { text: prompt || '' }
          ]
        }
      ];
    } else {
      contents = [
        {
          parts: [{ text: prompt || '' }]
        }
      ];
    }

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      throw new Error(data?.error?.message || `Google API Hatası: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});