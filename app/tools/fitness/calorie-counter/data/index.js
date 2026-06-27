import fruits from './fruits.json';
import vegetables from './vegetables.json';
import grainsBreads from './grains-breads.json';
import dalsLegumes from './dals-legumes.json';
import dairyFats from './dairy-fats.json';
import proteinsNonveg from './proteins-nonveg.json';
import indianCurries from './indian-curries.json';
import indianSnacks from './indian-snacks.json';
import chineseAsian from './chinese-asian.json';
import fastFood from './fast-food.json';
import beverages from './beverages.json';
import nutsSeeds from './nuts-seeds.json';
import dessertsSweets from './desserts-sweets.json';
import breakfastCereal from './breakfast-cereal.json';
import westernContinental from './western-continental.json';
import condimentsSnacks from './condiments-snacks.json';

export const foodCategories = [
  { key: 'fruits', label: '🍎 Fruits', icon: '🍎', items: fruits },
  { key: 'vegetables', label: '🥦 Vegetables', icon: '🥦', items: vegetables },
  { key: 'grains-breads', label: '🍞 Grains & Breads', icon: '🍞', items: grainsBreads },
  { key: 'dals-legumes', label: '🫘 Dals & Legumes', icon: '🫘', items: dalsLegumes },
  { key: 'dairy-fats', label: '🥛 Dairy & Fats', icon: '🥛', items: dairyFats },
  { key: 'proteins-nonveg', label: '🍗 Proteins & Non-Veg', icon: '🍗', items: proteinsNonveg },
  { key: 'indian-curries', label: '🍛 Indian Curries & Sabzis', icon: '🍛', items: indianCurries },
  { key: 'indian-snacks', label: '🥟 Indian Breakfast & Snacks', icon: '🥟', items: indianSnacks },
  { key: 'chinese-asian', label: '🥡 Chinese & Asian', icon: '🥡', items: chineseAsian },
  { key: 'fast-food', label: '🍔 Fast Food & Global', icon: '🍔', items: fastFood },
  { key: 'western-continental', label: '🍝 Western & Continental', icon: '🍝', items: westernContinental },
  { key: 'breakfast-cereal', label: '🥞 Breakfast & Cereal', icon: '🥞', items: breakfastCereal },
  { key: 'beverages', label: '🥤 Beverages & Drinks', icon: '🥤', items: beverages },
  { key: 'nuts-seeds', label: '🥜 Nuts & Seeds', icon: '🥜', items: nutsSeeds },
  { key: 'desserts-sweets', label: '🍰 Desserts & Sweets', icon: '🍰', items: dessertsSweets },
  { key: 'condiments-snacks', label: '🧂 Condiments & Packaged Snacks', icon: '🧂', items: condimentsSnacks },
];

// Flat array of all foods with category info for search
export const allFoods = foodCategories.flatMap(cat =>
  cat.items.map(item => ({ ...item, category: cat.key, categoryLabel: cat.label }))
);

export default foodCategories;
