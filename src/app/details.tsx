import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

const MAX_CONTENT_WIDTH = 900;
const WIDE_BREAKPOINT = 720;
// Same category-specific sizing scheme as the Add/Edit screens — a product's
// available sizes depend on what kind of item it is (a shoe isn't S/M/L).
const SIZE_OPTIONS: Record<string, string[]> = {
  'T-shirt': ['S', 'M', 'L', 'XL', '2XL'],
  Pant: ['28', '30', '32', '34', '36', '38'],
  Shoes: ['US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9', 'US 9.5', 'US 10', 'US 10.5', 'US 11', 'US 11.5', 'US 12', 'US 12.5', 'US 13'],
  Hat: ['S/M', 'L/XL', 'One Size'],
};

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const product = params.product ? JSON.parse(params.product as string) : {};
  const userRole = user?.role || (params.role as string) || 'user';
  const isLow = product.stock < 5;
  const productCategory = product.category || product.Category || '';
  const selectedSize = product.size || product.Size || 'M';
  // Fall back to the T-shirt scheme for categories saved before this
  // feature existed; if the saved size isn't in that list either, show it
  // anyway rather than hiding data the admin actually set.
  const baseSizes = SIZE_OPTIONS[productCategory] ?? SIZE_OPTIONS['T-shirt'];
  const sizesToShow = baseSizes.includes(selectedSize) ? baseSizes : [selectedSize, ...baseSizes];

  const handleDeletePress = () => {
    const message = `Are you sure you want to delete "${product.name}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDelete();
      }
    } else {
      Alert.alert('Delete product', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete }
      ]);
    }
  };

  const confirmDelete = async () => {
    try {
      const id = product.id;
      const res = await fetch(api(`/api/products/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (Platform.OS === 'web') window.alert('Product deleted successfully');
        router.back();
      } else {
        alert(data.error || 'Failed to delete product');
      }
    } catch (err) {
      console.error(err);
      alert('Unable to delete product');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageInner}>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{'\u2190'} Back to list</Text>
        </TouchableOpacity>

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.imageBox, isWide && styles.imageBoxWide]}>
            {product.image ? (
              <Image
                source={{ uri: product.image }}
                style={styles.productImg}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.placeholderText}>SYNDICATE</Text>
            )}
          </View>

          <View style={[styles.info, isWide && styles.infoWide]}>
            <Text style={styles.title}>{product.name}</Text>
            <Text style={styles.price}>${Number(product.price ?? product.Price ?? 0).toFixed(2)}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Code</Text>
              <Text style={styles.metaValue}>{product.productCode || '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{product.category || 'General'}</Text>
            </View>

            <Text style={styles.sizeSectionLabel}>Size</Text>
            <View style={styles.sizeGrid}>
              {sizesToShow.map((s) => {
                const isSelected = s === selectedSize;
                return (
                  <View key={s} style={[styles.sizeBox, isSelected && styles.sizeBoxSelected]}>
                    <Text style={[styles.sizeBoxText, isSelected && styles.sizeBoxTextSelected]}>{s}</Text>
                  </View>
                );
              })}
            </View>

            <View style={[styles.stockBadge, isLow && styles.stockBadgeLow]}>
              <Text style={styles.stockBadgeText}>
                {product.stock === 0 ? 'SOLD OUT' : `${product.stock} IN STOCK`}
              </Text>
            </View>

            {/* Edit/Delete only shown to admins */}
            {userRole === 'admin' && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push({ pathname: '/edit', params: { product: JSON.stringify(product) } })}
                >
                  <Text style={styles.editBtnText}>Edit Product</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  pageInner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: 20 },

  backLink: { alignSelf: 'flex-start', marginBottom: 16 },
  backLinkText: { color: '#666', fontSize: 14, fontWeight: '600' },

  layout: { flexDirection: 'column', gap: 20 },
  layoutWide: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },

  imageBox: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: '#F4F4F4',
    borderWidth: 1,
    borderColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageBoxWide: { width: 380, aspectRatio: 1 },
  productImg: { width: '100%', height: '100%' },
  placeholderText: { color: '#111', fontSize: 20, fontWeight: '800', letterSpacing: 3 },

  info: { flex: 1 },
  infoWide: { paddingTop: 4 },

  title: { fontSize: 26, fontWeight: '900', color: '#111', marginBottom: 8 },
  price: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 16 },

  metaRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  metaLabel: { width: 90, fontSize: 13, color: '#999', fontWeight: '600' },
  metaValue: { flex: 1, fontSize: 14, color: '#111' },

  sizeSectionLabel: { fontSize: 13, color: '#999', fontWeight: '600', marginTop: 18, marginBottom: 10 },
  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeBox: {
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBoxSelected: { backgroundColor: '#111', borderColor: '#111' },
  sizeBoxText: { fontSize: 14, fontWeight: '700', color: '#111' },
  sizeBoxTextSelected: { color: '#fff' },

  stockBadge: { alignSelf: 'flex-start', backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 18, marginBottom: 24 },
  stockBadgeLow: { backgroundColor: '#111' },
  stockBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  btnRow: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#D8D8D8' },
  deleteBtn: { flex: 1, backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  editBtnText: { color: '#111', fontWeight: 'bold', fontSize: 15 },
  deleteBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
