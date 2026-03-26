// Preset stores for grocery list
export const STORES = ["Pilgrim's", 'Costco', 'Grocery Store']

// Produce keywords that default to Pilgrim's
const PRODUCE_KEYWORDS = [
  'apple', 'apricot', 'avocado', 'banana', 'berry', 'blackberry', 'blueberry',
  'broccoli', 'cabbage', 'cantaloupe', 'carrot', 'cauliflower', 'celery',
  'cherry', 'clementine', 'corn', 'cucumber', 'date', 'eggplant', 'fig',
  'garlic', 'ginger', 'grape', 'grapefruit', 'greens', 'honeydew', 'jalapeno',
  'kale', 'kiwi', 'leek', 'lemon', 'lettuce', 'lime', 'mango', 'melon',
  'mushroom', 'nectarine', 'onion', 'orange', 'papaya', 'parsnip', 'peach',
  'pear', 'pepper', 'pineapple', 'plum', 'pomegranate', 'potato', 'radish',
  'raspberry', 'romaine', 'scallion', 'shallot', 'spinach', 'sprout', 'squash',
  'strawberry', 'sweet potato', 'tangerine', 'tomato', 'turnip', 'watermelon',
  'yam', 'zucchini',
  // herbs
  'basil', 'cilantro', 'dill', 'herb', 'mint', 'oregano', 'parsley',
  'rosemary', 'sage', 'thyme',
  // general
  'produce', 'fruit', 'vegetable', 'veggie', 'salad',
]

export function getDefaultStore(itemName) {
  if (!itemName) return 'Grocery Store'
  const lower = itemName.toLowerCase()
  const isMatch = PRODUCE_KEYWORDS.some(kw => lower.includes(kw))
  return isMatch ? "Pilgrim's" : 'Grocery Store'
}

// Common units
export const UNITS = ['count', 'slices', 'lbs', 'oz', 'bags', 'boxes', 'cans', 'jars', 'bottles', 'packages']

// Section colors (warm palette)
export const SECTION_COLORS = {
  grocery: { bg: 'bg-section-grocery', text: 'text-section-grocery', light: 'bg-section-grocery/10', ring: 'ring-section-grocery', border: 'border-section-grocery' },
  freezer: { bg: 'bg-section-freezer', text: 'text-section-freezer', light: 'bg-section-freezer/10', ring: 'ring-section-freezer', border: 'border-section-freezer' },
  fridge: { bg: 'bg-section-fridge', text: 'text-section-fridge', light: 'bg-section-fridge/10', ring: 'ring-section-fridge', border: 'border-section-fridge' },
  pantry: { bg: 'bg-section-pantry', text: 'text-section-pantry', light: 'bg-section-pantry/10', ring: 'ring-section-pantry', border: 'border-section-pantry' },
  cookbook: { bg: 'bg-section-cookbook', text: 'text-section-cookbook', light: 'bg-section-cookbook/10', ring: 'ring-section-cookbook', border: 'border-section-cookbook' },
  home_goods: { bg: 'bg-section-homegoods', text: 'text-section-homegoods', light: 'bg-section-homegoods/10', ring: 'ring-section-homegoods', border: 'border-section-homegoods' },
}

// Full taxonomy: categories and subcategories per location
export const TAXONOMY = {
  freezer: {
    'Beef': ['Ribeye', 'NY Strip', 'T-Bone', 'Flank Steak', 'Sirloin', 'Brisket', 'Chuck Roast', 'Short Ribs', 'Other'],
    'Pork': ['Pork Chops', 'Pork Tenderloin', 'Pork Shoulder', 'Pork Ribs', 'Pork Loin', 'Other'],
    'Chicken': ['Breast', 'Thighs', 'Wings', 'Drumsticks', 'Whole Chicken', 'Tenders', 'Other'],
    'Turkey': ['Turkey Breast', 'Whole Turkey', 'Turkey Cutlets', 'Other'],
    'Ground Meat': ['Ground Beef', 'Ground Turkey', 'Ground Chicken', 'Ground Pork', 'Italian Sausage', 'Breakfast Sausage', 'Kielbasa', 'Bratwurst', 'Chorizo', 'Other'],
    'Fish': ['Salmon', 'Tilapia', 'Cod', 'Halibut', 'Mahi Mahi', 'Tuna', 'Other'],
    'Seafood': ['Shrimp (Raw)', 'Shrimp (Cooked)', 'Scallops', 'Crab', 'Lobster', 'Other'],
    'Frozen Produce': null,
    'Frozen Meals': null,
    'Other': null,
  },
  fridge: {
    'Deli Meat': ['Black Forest Ham', 'Honey Ham', 'Roasted Turkey', 'Deli Chicken', 'Salami', 'Pepperoni', 'Prosciutto', 'Other'],
    'Bacon': null,
    'Dairy': null,
    'Condiments': null,
    'Broth/Stock': null,
    'Bread': null,
    'Beverages': null,
    'Fresh Produce': null,
    'Other': null,
  },
  pantry: {
    'Pasta': ['Spaghetti', 'Penne', 'Bow Tie (Farfalle)', 'Elbow', 'Fettuccine', 'Linguine', 'Angel Hair', 'Rigatoni', 'Rotini', 'Lasagna', 'Orzo', 'Other'],
    'Bread': null,
    'Canned Goods': null,
    'Dry Goods': null,
    'Sauces & Condiments': null,
    'Spices': null,
    'Snacks': null,
    'Baking': null,
    'Beverages': null,
    'Other': null,
  },
  home_goods: {
    'Paper Products': null,
    'Cleaning': null,
    'Trash & Storage': null,
    'Personal Care': null,
    'Medicine': null,
    'Laundry': null,
    'Other': null,
  },
}

// Default units per category per location
export const DEFAULT_UNITS = {
  freezer: {
    'Beef': 'lbs',
    'Pork': 'lbs',
    'Chicken': 'lbs',
    'Turkey': 'lbs',
    'Ground Meat': 'lbs',
    'Fish': 'lbs',
    'Seafood': 'lbs',
    'Frozen Produce': 'bags',
    'Frozen Meals': 'count',
    'Other': 'count',
  },
  fridge: {
    'Deli Meat': 'lbs',
    'Bacon': 'packages',
    'Dairy': 'count',
    'Condiments': 'bottles',
    'Broth/Stock': 'count',
    'Bread': 'count',
    'Beverages': 'count',
    'Fresh Produce': 'count',
    'Other': 'count',
  },
  pantry: {
    'Pasta': 'boxes',
    'Bread': 'count',
    'Canned Goods': 'cans',
    'Dry Goods': 'bags',
    'Sauces & Condiments': 'bottles',
    'Spices': 'jars',
    'Snacks': 'bags',
    'Baking': 'bags',
    'Beverages': 'count',
    'Other': 'count',
  },
  home_goods: {
    'Paper Products': 'rolls',
    'Cleaning': 'bottles',
    'Trash & Storage': 'boxes',
    'Personal Care': 'count',
    'Medicine': 'count',
    'Laundry': 'count',
    'Other': 'count',
  },
}
