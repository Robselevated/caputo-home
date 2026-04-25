// Preset stores for grocery list
export const STORES = ["Pilgrim's", 'Costco', 'Grocery Store']

// Produce keywords that default to Pilgrim's
const PRODUCE_KEYWORDS = [
  'apple', 'apricot', 'avocado', 'banana', 'berry', 'blackberry', 'blueberry',
  'broccoli', 'cabbage', 'cantaloupe', 'carrot', 'cauliflower', 'celery',
  'cherry', 'clementine', 'corn', 'cucumber', 'date', 'eggplant', 'fig',
  'garlic', 'ginger', 'grape', 'grapefruit', 'greens', 'honeydew', 'jalapeno',
  'kale', 'kiwi', 'leek', 'lemon', 'lettuce', 'lime', 'mandarin', 'mango', 'melon',
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

// Item-to-location mapping for auto-adding checked grocery items to inventory
const LOCATION_RULES = [
  // Fridge: produce (reuse existing PRODUCE_KEYWORDS)
  { keywords: PRODUCE_KEYWORDS, location: 'fridge', category: 'Fresh Produce' },
  // Fridge: dairy
  { keywords: ['milk', 'cream cheese', 'sour cream', 'half and half', 'half & half', 'half&half', 'h&h', 'heavy cream', 'whipping cream', 'cream', 'cheese', 'yogurt', 'butter', 'egg', 'eggs', 'cottage', 'mozzarella', 'parmesan', 'cheddar', 'provolone', 'swiss', 'gouda', 'brie', 'ricotta'], location: 'fridge', category: 'Dairy' },
  // Fridge: deli
  { keywords: ['deli', 'ham', 'turkey breast', 'salami', 'pepperoni', 'prosciutto', 'lunch meat', 'roast beef'], location: 'fridge', category: 'Deli Meat' },
  // Fridge: bacon
  { keywords: ['bacon'], location: 'fridge', category: 'Bacon' },
  // Fridge: beverages
  { keywords: ['juice', 'kombucha', 'creamer', 'almond milk', 'oat milk'], location: 'fridge', category: 'Beverages' },
  // Fridge: condiments
  { keywords: ['ranch', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'hot sauce', 'soy sauce', 'sriracha', 'salsa', 'hummus', 'guacamole', 'pesto', 'relish', 'horseradish', 'tartar sauce'], location: 'fridge', category: 'Condiments' },
  // Fridge: broth
  { keywords: ['broth', 'stock'], location: 'fridge', category: 'Broth/Stock' },
  // Fridge: bread (fresh)
  { keywords: ['bread', 'tortilla', 'pita', 'naan', 'bagel', 'english muffin', 'bun', 'roll', 'croissant'], location: 'fridge', category: 'Bread' },
  // Freezer: meats (check before generic frozen)
  { keywords: ['chicken breast', 'chicken thigh', 'chicken wing', 'chicken tender', 'chicken drum', 'whole chicken'], location: 'freezer', category: 'Chicken' },
  { keywords: ['ground beef', 'ground turkey', 'ground chicken', 'ground pork', 'italian sausage', 'breakfast sausage', 'kielbasa', 'bratwurst', 'chorizo', 'sausage'], location: 'freezer', category: 'Ground Meat' },
  { keywords: ['steak', 'ribeye', 'ny strip', 'sirloin', 'flank', 'brisket', 'chuck roast', 'short rib', 't-bone'], location: 'freezer', category: 'Beef' },
  { keywords: ['pork chop', 'pork tenderloin', 'pork shoulder', 'pork rib', 'pork loin', 'pork butt'], location: 'freezer', category: 'Pork' },
  { keywords: ['turkey breast', 'whole turkey', 'turkey cutlet'], location: 'freezer', category: 'Turkey' },
  { keywords: ['salmon', 'tilapia', 'cod', 'halibut', 'mahi', 'tuna steak', 'swordfish', 'trout'], location: 'freezer', category: 'Fish' },
  { keywords: ['shrimp', 'scallop', 'crab', 'lobster', 'clam', 'mussel', 'calamari'], location: 'freezer', category: 'Seafood' },
  { keywords: ['frozen', 'ice cream', 'popsicle', 'frozen pizza', 'frozen waffle', 'frozen fries', 'tater tot', 'hot pocket', 'tv dinner'], location: 'freezer', category: 'Frozen Meals' },
  // Pantry
  { keywords: ['pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'rigatoni', 'macaroni', 'rotini', 'farfalle', 'orzo', 'lasagna', 'angel hair', 'elbow'], location: 'pantry', category: 'Pasta' },
  { keywords: ['canned', 'can of', 'cans of', 'beans', 'chickpea', 'lentil', 'diced tomato', 'crushed tomato', 'tomato paste', 'tomato sauce', 'coconut milk'], location: 'pantry', category: 'Canned Goods' },
  { keywords: ['rice', 'flour', 'sugar', 'oats', 'oatmeal', 'quinoa', 'cereal', 'granola', 'cornmeal', 'panko', 'breadcrumb'], location: 'pantry', category: 'Dry Goods' },
  { keywords: ['chips', 'crackers', 'pretzels', 'popcorn', 'granola bar', 'snack', 'trail mix', 'nuts', 'almonds', 'cashews', 'peanuts', 'pistachios'], location: 'pantry', category: 'Snacks' },
  { keywords: ['olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'avocado oil', 'sesame oil', 'cooking spray', 'vinegar'], location: 'pantry', category: 'Oils' },
  { keywords: ['cumin', 'paprika', 'garlic powder', 'onion powder', 'cinnamon', 'pepper flake', 'chili powder', 'cayenne', 'turmeric', 'nutmeg', 'italian seasoning', 'taco seasoning', 'everything bagel', 'seasoning', 'spice'], location: 'pantry', category: 'Spices' },
  { keywords: ['baking soda', 'baking powder', 'vanilla extract', 'cocoa', 'chocolate chip', 'yeast', 'cornstarch', 'powdered sugar', 'brown sugar', 'confectioner'], location: 'pantry', category: 'Baking' },
  { keywords: ['marinara', 'pasta sauce', 'bbq sauce', 'teriyaki', 'worcestershire', 'enchilada sauce', 'alfredo', 'hoisin', 'fish sauce', 'oyster sauce'], location: 'pantry', category: 'Sauces & Condiments' },
  { keywords: ['coffee', 'tea bag', 'hot chocolate', 'water bottle', 'soda', 'sparkling water', 'gatorade', 'energy drink'], location: 'pantry', category: 'Beverages' },
  // Home goods
  { keywords: ['paper towel', 'toilet paper', 'napkin', 'tissue', 'paper plate', 'paper cup'], location: 'home_goods', category: 'Paper Products' },
  { keywords: ['dish soap', 'hand soap', 'cleaner', 'sponge', 'bleach', 'wipe', 'disinfectant', 'lysol', 'clorox'], location: 'home_goods', category: 'Cleaning' },
  { keywords: ['trash bag', 'garbage bag', 'ziploc', 'zip lock', 'aluminum foil', 'plastic wrap', 'parchment', 'sandwich bag', 'freezer bag'], location: 'home_goods', category: 'Trash & Storage' },
  { keywords: ['shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'deodorant', 'lotion', 'razor', 'body wash', 'sunscreen', 'floss'], location: 'home_goods', category: 'Personal Care' },
  { keywords: ['advil', 'tylenol', 'ibuprofen', 'vitamin', 'medicine', 'bandaid', 'band-aid', 'pepto', 'tums', 'allergy'], location: 'home_goods', category: 'Medicine' },
  { keywords: ['detergent', 'laundry', 'dryer sheet', 'fabric softener', 'stain remover', 'tide', 'downy'], location: 'home_goods', category: 'Laundry' },
]

export function getDefaultLocation(itemName) {
  if (!itemName) return { location: 'pantry', category: 'Other' }
  const lower = itemName.toLowerCase()
  for (const rule of LOCATION_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return { location: rule.location, category: rule.category }
    }
  }
  return { location: 'pantry', category: 'Other' }
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
    'Oils': null,
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
    'Oils': 'bottles',
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
