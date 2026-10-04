export interface BarcodeProductResult {
  found: boolean;
  name?: string;
  brand?: string;
  quantity?: string;
  imageUrl?: string;
}

export const fetchProductByBarcode = async (barcode: string): Promise<BarcodeProductResult> => {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const product = data.product;
      
      // Türkçe veya genel ürün adı önceliği
      const productName = product.product_name_tr || product.product_name || 'Bilinmeyen Ürün';
      const brand = product.brands ? product.brands.split(',')[0].trim() : 'Genel Marka';
      const quantity = product.quantity || '1 Adet';
      const imageUrl = product.image_front_small_url || product.image_url || undefined;

      return {
        found: true,
        name: productName,
        brand: brand,
        quantity: quantity,
        imageUrl: imageUrl,
      };
    }
  } catch {
    // Hata durumunda sessizce geçilir
  }

  return { found: false };
};