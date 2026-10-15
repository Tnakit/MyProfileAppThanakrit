import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'expo-router';
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

// The product code isn't typed in by hand anymore — generate a short,
// effectively-unique one automatically so every product still has one to
// look up or scan by later, without asking the admin to invent it.
function generateProductCode() {
  return `PC-${Date.now().toString(36).toUpperCase()}`;
}

export default function AddProductScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [size, setSize] = useState(SIZE_OPTIONS[CATEGORIES[0]][0]);

  const sizeOptions = SIZE_OPTIONS[category] ?? [];

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    // Reset to that category's first size so we never save a shoe size
    // against a hat, or vice versa, when switching categories.
    setSize(SIZE_OPTIONS[cat]?.[0] ?? '');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Product name is required');
      return;
    }

    try {
      const res = await fetch(api('/api/products'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          Name: name,
          Category: category,
          Stock: Number(stock) || 0,
          Price: Number(price) || 0,
          Productcode: generateProductCode(),
          Image: image,
          Size: size,
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (Platform.OS === 'web') window.alert('Product added successfully!');
        router.back();
      } else {
        alert(data.error || 'Failed to add product');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New Product</Text>

      <TextInput style={styles.input} placeholder="Product Name" placeholderTextColor="#888" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Stock" placeholderTextColor="#888" value={stock} onChangeText={setStock} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Price" placeholderTextColor="#888" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <TextInput style={styles.input} placeholder="Image URL" placeholderTextColor="#888" value={image} onChangeText={setImage} />

      <Text style={styles.label}>Category</Text>
      <View style={styles.pillRow}>
        {CATEGORIES.map((cat) => (
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

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveText}>Save Product</Text>
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
