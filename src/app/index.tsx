import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

// The DB returns columns exactly as they're named in MySQL (Product_ID, Name,
// Category, Stock, Productcode, Image, Size) — this turns that into a
// consistent shape the rest of the screens can rely on.
function normalizeProduct(item: any) {
  return {
    id: item.Product_ID ?? item.id,
    name: item.Name ?? item.name ?? '',
    category: item.Category ?? item.category ?? '',
    stock: item.Stock ?? item.stock ?? 0,
    productCode: item.Productcode ?? item.productCode ?? '',
    image: item.Image ?? item.image ?? '',
    size: item.Size ?? item.size ?? 'M',
    price: Number(item.Price ?? item.price ?? 0),
  };
}

type Product = ReturnType<typeof normalizeProduct>;
type PriceTier = 'Low' | 'Mid' | 'High';
type TieredProduct = Product & { priceTier: PriceTier };

// Client-side K-Means (same technique from the course assignment) — groups
// products into three price tiers on-device instead of asking the server.
// Generalized to work on our own product list (by .price) rather than the
// course's separate sample table.
function clusterPricesLocally(data: Product[]): TieredProduct[] {
  if (!data || data.length === 0) return [];
  const prices = data.map((item) => item.price);

  let centroids = [
    Math.min(...prices),
    (Math.min(...prices) + Math.max(...prices)) / 2,
    Math.max(...prices),
  ];

  let assignments: number[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    assignments = prices.map((price) => {
      const diffs = centroids.map((c) => Math.abs(price - c));
      return diffs.indexOf(Math.min(...diffs));
    });

    const newCentroids = [0, 1, 2].map((i) => {
      const clusterPrices = prices.filter((_, index) => assignments[index] === i);
      return clusterPrices.length
        ? clusterPrices.reduce((a, b) => a + b, 0) / clusterPrices.length
        : centroids[i];
    });

    if (JSON.stringify(centroids) !== JSON.stringify(newCentroids)) {
      centroids = newCentroids;
      changed = true;
    }
  }

  const sortedCentroids = [...centroids].sort((a, b) => a - b);
  const labels: PriceTier[] = ['Low', 'Mid', 'High'];

  return data.map((item, index) => {
    const myCentroid = centroids[assignments[index]];
    const tierIndex = sortedCentroids.indexOf(myCentroid);
    return { ...item, priceTier: labels[tierIndex] };
  });
}

const MAX_CONTENT_WIDTH = 1200;
const CARD_GAP = 16;

function ImagePlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText} numberOfLines={1} adjustsFontSizeToFit>
        SYNDICATE
      </Text>
    </View>
  );
}

// A plain geometric magnifying-glass drawn from two Views — crisper and
// more consistent across platforms than relying on an emoji glyph.
function SearchIcon({ size = 13, color = '#111' }: { size?: number; color?: string }) {
  const box = size + 8;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.6, borderColor: color }} />
      <View
        style={{
          position: 'absolute',
          width: 1.6,
          height: size * 0.5,
          backgroundColor: color,
          bottom: 1,
          right: 2,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { width, height: windowHeight } = useWindowDimensions();

  const cardWidth = width < 640 ? 220 : width < 960 ? 260 : 300;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const scrollStep = cardWidth + CARD_GAP;
  // Image (3:4) + name/category text + admin edit/delete row + border —
  // bounding this explicitly stops the horizontal ScrollView from
  // stretching to fill the page's remaining height on web, which was
  // dragging every card down into a tall, mostly-empty box.
  const cardHeight = Math.round((cardWidth * 4) / 3) + 138;
  const searchOverlayHeight = Math.round(windowHeight * 0.5);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTier, setActiveTier] = useState<'All' | PriceTier>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);

  const fetchProducts = async () => {
    try {
      const response = await fetch(api('/api/products'));
      const data = await response.json();
      if (response.ok) {
        setProducts(data.map(normalizeProduct));
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch every time this screen comes back into focus (e.g. after
  // returning from Add/Edit), so the list is never stale.
  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  // Price tier per product (K-Means over the whole catalog) — a lookup so
  // each card can show its own badge and the tier tabs can filter by it.
  const tierById = useMemo(() => {
    const map = new Map<Product['id'], PriceTier>();
    clusterPricesLocally(products).forEach((p) => map.set(p.id, p.priceTier));
    return map;
  }, [products]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['All', ...unique];
  }, [products]);

  const filteredProducts = products.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesTier = activeTier === 'All' || tierById.get(item.id) === activeTier;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesTier && matchesSearch;
  });

  const sectionTitle = searchQuery
    ? `Results for "${searchQuery}"`
    : activeCategory === 'All'
    ? 'All Products'
    : activeCategory;

  const handleLogout = () => {
    logout();
    if (Platform.OS === 'web') window.alert('Logged out successfully');
    router.replace('/login');
  };

  const doDelete = async (id: number | string) => {
    try {
      const res = await fetch(api(`/api/products/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchProducts();
      } else {
        alert(data.error || 'Failed to delete product');
      }
    } catch (err) {
      console.error(err);
      alert('Unable to delete product');
    }
  };

  const handleDeletePress = (id: number | string, name: string) => {
    const message = `Are you sure you want to delete "${name}"?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) doDelete(id);
    } else {
      doDelete(id);
    }
  };

  const openDetail = (item: Product) => {
    router.push({
      pathname: '/details',
      params: { product: JSON.stringify(item), role: user?.role || 'user' }
    });
  };

  const scrollByStep = (direction: 1 | -1) => {
    const next = Math.max(0, scrollX.current + direction * scrollStep * 2);
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  const openSearch = () => {
    setSearchDraft(searchQuery);
    setSearchOpen(true);
  };

  const applySearch = (value: string) => {
    setSearchQuery(value);
    setSearchOpen(false);
  };

  const cancelSearch = () => {
    setSearchOpen(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.pageInner}>
        {/* Top bar: brand + account actions */}
        <View style={styles.topBar}>
          <Text style={styles.brandTitle}>SYNDICATE STREET</Text>

          <View style={styles.topBarActions}>
            {user?.role === 'admin' && (
              <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add')}>
                <Text style={styles.addBtnText}>+ Add Product</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.searchPill} onPress={openSearch}>
              <SearchIcon size={12} color="#666" />
              <Text style={styles.searchPillText} numberOfLines={1}>
                {searchQuery || 'Search'}
              </Text>
            </TouchableOpacity>

            {user ? (
              <TouchableOpacity style={styles.actionBtnOutline} onPress={handleLogout}>
                <Text style={styles.actionBtnOutlineText}>Logout</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => router.replace('/login')}>
                <Text style={styles.actionBtnPrimaryText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {user && (
          <Text style={styles.welcomeText}>
            Welcome, {user.username} ({user.role.toUpperCase()})
          </Text>
        )}

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
          {categories.map((cat) => {
            const active = cat === activeCategory;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Price-tier filter, from the same K-Means grouping shown on each card */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tierTabsRow}>
          {(['All', 'Low', 'Mid', 'High'] as const).map((tier) => {
            const active = tier === activeTier;
            return (
              <TouchableOpacity
                key={tier}
                style={[styles.tierTabPill, active && styles.tierTabPillActive]}
                onPress={() => setActiveTier(tier)}
              >
                <Text style={[styles.tierTabPillText, active && styles.tierTabPillTextActive]}>
                  {tier === 'All' ? 'All Prices' : tier}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section header with prev/next arrows */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <View style={styles.arrowRow}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => scrollByStep(-1)}>
              <Text style={styles.arrowText}>{'\u2039'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => scrollByStep(1)}>
              <Text style={styles.arrowText}>{'\u203A'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading products…</Text>
        ) : filteredProducts.length === 0 ? (
          <Text style={styles.emptyText}>No products found</Text>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={16}
            style={{ height: cardHeight, flexGrow: 0 }}
            contentContainerStyle={styles.carousel}
          >
            {filteredProducts.map((item) => {
              const isLow = item.stock < 5;
              const tier = tierById.get(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => openDetail(item)}
                  style={({ hovered, pressed }) => [
                    styles.card,
                    { width: cardWidth },
                    hovered && styles.cardHovered,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.imageWrap}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                    {tier && (
                      <View
                        style={[
                          styles.tierBadge,
                          tier === 'Low' && styles.tierBadgeLow,
                          tier === 'Mid' && styles.tierBadgeMid,
                          tier === 'High' && styles.tierBadgeHigh,
                        ]}
                      >
                        <Text style={[styles.tierBadgeText, tier === 'Low' && styles.tierBadgeTextLow]}>
                          {tier}
                        </Text>
                      </View>
                    )}
                    {isLow && (
                      <View style={styles.stockTag}>
                        <Text style={styles.stockTagText}>
                          {item.stock === 0 ? 'SOLD OUT' : `ONLY ${item.stock} LEFT`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productCategory} numberOfLines={1}>{item.category || 'General'}</Text>
                    <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                  </View>

                  {user?.role === 'admin' && (
                    <View style={styles.adminActionRow}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => router.push({ pathname: '/edit', params: { product: JSON.stringify(item) } })}
                      >
                        <Text style={styles.editText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePress(item.id, item.name)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Half-screen search panel — the product carousel stays visible below it */}
      {searchOpen && (
        <>
          <Pressable style={[styles.searchBackdrop, { top: searchOverlayHeight }]} onPress={cancelSearch} />
          <View style={[styles.searchOverlay, { height: searchOverlayHeight }]}>
            <SafeAreaView style={styles.searchOverlayInner}>
              <View style={styles.searchOverlayTopRow}>
                <View style={styles.searchOverlayInputWrap}>
                  <SearchIcon size={14} color="#111" />
                  <TextInput
                    style={styles.searchOverlayInput}
                    placeholder="Search products..."
                    placeholderTextColor="#999"
                    value={searchDraft}
                    onChangeText={setSearchDraft}
                    autoFocus
                    onSubmitEditing={() => applySearch(searchDraft)}
                    returnKeyType="search"
                  />
                </View>
                <TouchableOpacity onPress={cancelSearch}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.popularLabel}>Popular categories</Text>
              <View style={styles.popularTags}>
                {categories.filter((c) => c !== 'All').map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.popularTag}
                    onPress={() => {
                      setActiveCategory(cat);
                      applySearch('');
                    }}
                  >
                    <Text style={styles.popularTagText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SafeAreaView>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  pageInner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#111', letterSpacing: 1 },
  welcomeText: { fontSize: 12, color: '#999', marginTop: 4, marginBottom: 4 },

  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: { backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 160,
    gap: 6,
  },
  searchPillText: { fontSize: 13, color: '#666' },

  actionBtnPrimary: { backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionBtnOutline: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionBtnOutlineText: { color: '#111', fontWeight: '600', fontSize: 12 },

  tabsRow: { marginTop: 18, flexGrow: 0 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F2F2F2' },
  tabPillActive: { backgroundColor: '#111' },
  tabPillText: { fontSize: 13, fontWeight: '600', color: '#111' },
  tabPillTextActive: { color: '#fff' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  arrowRow: { flexDirection: 'row', gap: 8 },
  arrowBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 18, color: '#111', fontWeight: '700' },

  emptyText: { color: '#999', textAlign: 'center', marginTop: 60 },

  carousel: { gap: CARD_GAP, alignItems: 'flex-start' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignSelf: 'flex-start',
    ...(Platform.OS === 'web'
      ? ({ transitionProperty: 'transform, box-shadow, border-color', transitionDuration: '150ms' } as any)
      : null),
  },
  cardHovered: Platform.OS === 'web'
    ? ({ transform: [{ translateY: -4 }], borderColor: '#111', boxShadow: '0 10px 24px rgba(0,0,0,0.12)' } as any)
    : {},
  cardPressed: { opacity: 0.9 },

  imageWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#F2F2F2' },
  productImage: { width: '100%', height: '100%' },

  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', paddingHorizontal: 10 },
  placeholderText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 3 },

  stockTag: { position: 'absolute', left: 0, bottom: 0, backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 4 },
  stockTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  cardInfo: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  productName: { fontSize: 13, fontWeight: '600', color: '#111', lineHeight: 17 },
  productCategory: { fontSize: 12, color: '#8C8C8C', marginTop: 3 },
  productPrice: { fontSize: 13, fontWeight: '700', color: '#111', marginTop: 4 },

  adminActionRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 },
  editBtn: { flex: 1, backgroundColor: '#fff', paddingVertical: 6, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#D8D8D8' },
  editText: { color: '#111', fontSize: 11, fontWeight: 'bold' },
  deleteBtn: { flex: 1, backgroundColor: '#111', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Search overlay: a dropdown panel over the top half of the screen, with
  // a dim backdrop over the remaining area so the carousel still peeks
  // through and tapping it closes the search.
  searchBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 15,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 12px 24px rgba(0,0,0,0.08)' } as any) : null),
  },
  searchOverlayInner: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  searchOverlayTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  searchOverlayInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchOverlayInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#111' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#111' },

  popularLabel: { fontSize: 13, color: '#999', fontWeight: '600', marginTop: 28, marginBottom: 12 },
  popularTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  popularTag: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F2F2F2' },
  popularTagText: { fontSize: 14, fontWeight: '600', color: '#111' },

  // Price-tier tabs — same pill style as category tabs, on their own row.
  tierTabsRow: { marginTop: 10, flexGrow: 0 },
  tierTabPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#DDD' },
  tierTabPillActive: { backgroundColor: '#111', borderColor: '#111' },
  tierTabPillText: { fontSize: 12, fontWeight: '600', color: '#111' },
  tierTabPillTextActive: { color: '#fff' },

  // Price-tier badge on each card — grey intensity (light → dark) marks
  // Low/Mid/High rather than color, staying monochrome. Sits opposite the
  // low-stock tag so the two never collide.
  tierBadge: { position: 'absolute', right: 0, top: 0, paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 6 },
  tierBadgeLow: { backgroundColor: '#F0F0F0' },
  tierBadgeMid: { backgroundColor: '#888' },
  tierBadgeHigh: { backgroundColor: '#111' },
  tierBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  tierBadgeTextLow: { color: '#111' },
});
