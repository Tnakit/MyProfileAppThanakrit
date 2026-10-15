import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CATEGORIES = ['T-shirt', 'Pant', 'Shoes', 'Hat'];

// Each category has its own real-world sizing scheme, not just S–2XL for
// everything — shoes use US sizes, pants use waist measurements, etc.
const SIZE_OPTIONS: Record<string, string[]> = {
  'T-shirt': ['S', 'M', 'L', 'XL', '2XL'],
  Pant: ['28', '30', '32', '34', '36', '38'],
  Shoes: ['US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9', 'US 9.5', 'US 10', 'US 10.5', 'US 11', 'US 11.5', 'US 12', 'US 12.5', 'US 13'],
  Hat: ['S/M', 'L/XL', 'One Size'],
};

export default function EditProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const product = params.product ? JSON.parse(params.product as string) : {};

  const [productCode, setProductCode] = useState(product.productCode || product.Productcode || '');
  const [name, setName] = useState(product.name || product.Name || '');
  const [stock, setStock] = useState(String(product.stock ?? product.Stock ?? '0'));
  const [price, setPrice] = useState(String(product.price ?? product.Price ?? '0'));
  const [image, setImage] = useState(product.image || product.Image || '');

  const existingCategory = product.category || product.Category || CATEGORIES[0];
  const [category, setCategory] = useState(existingCategory);
  const existingSize = product.size || product.Size || SIZE_OPTIONS[existingCategory]?.[0] || '';
  const [size, setSize] = useState(existingSize);

  // Products saved before this picker existed (or with free-text
  // categories) might hold a category/size that isn't in our predefined
  // list — keep it selectable instead of silently dropping it.
  const categoryOptions = CATEGORIES.includes(existingCategory) ? CATEGORIES : [existingCategory, ...CATEGORIES];
  const baseSizeOptions = SIZE_OPTIONS[category] ?? [];
  const sizeOptions = baseSizeOptions.includes(size) || !size ? baseSizeOptions : [size, ...baseSizeOptions];

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setSize(SIZE_OPTIONS[cat]?.[0] ?? '');
  };

  const handleUpdate = async () => {
    try {
      const id = product.id || product.Product_ID;
      const res = await fetch(api(`/api/products/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          Productcode: productCode,
          Name: name,
          Stock: Number(stock) || 0,
          Price: Number(price) || 0,
          Category: category,
          Image: image,
          Size: size,
          // This form has no fields for these, so carry the existing
          // values through rather than silently wiping them on save.
          Location: product.location || product.Location || '',
          Status: product.status || product.Status || 'Active',
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (Platform.OS === 'web') window.alert('Product updated successfully!');
        router.back();
      } else {
        alert(data.error || 'Failed to update product');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Product</Text>

      <TextInput style={styles.input} placeholder="Product Code" placeholderTextColor="#888" value={productCode} onChangeText={setProductCode} />
      <TextInput style={styles.input} placeholder="Product Name" placeholderTextColor="#888" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Stock" placeholderTextColor="#888" value={stock} onChangeText={setStock} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Price" placeholderTextColor="#888" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <TextInput style={styles.input} placeholder="Image URL" placeholderTextColor="#888" value={image} onChangeText={setImage} />

      <Text style={styles.label}>Category</Text>
      <View style={styles.pillRow}>
        {categoryOptions.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, category === cat && styles.pillActive]}
            onPress={() => handleCategorySelect(cat)}
          >
            <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Size</Text>
      <View style={styles.pillRow}>
        {sizeOptions.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.pill, size === s && styles.pillActive]}
            onPress={() => setSize(s)}
          >
            <Text style={[styles.pillText, size === s && styles.pillTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
        <Text style={styles.saveText}>Update Product</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 20, color: '#111' },
  input: { borderWidth: 1, borderColor: '#ddd', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8, marginTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#111' },
  pillTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn: { padding: 12, alignItems: 'center', marginTop: 6 },
  backText: { color: '#666', fontWeight: 'bold' }
});
