// Preset stores for grocery list
export const STORES = ['Pilgrams', 'Costco', 'Store']

// Common units
export const UNITS = ['count', 'lbs', 'oz', 'bags', 'boxes', 'cans', 'jars', 'bottles', 'packages']

// Section colors
export const SECTION_COLORS = {
  grocery: { bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-50', ring: 'ring-green-500', border: 'border-green-500' },
  freezer: { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-50', ring: 'ring-blue-500', border: 'border-blue-500' },
  fridge: { bg: 'bg-teal-500', text: 'text-teal-500', light: 'bg-teal-50', ring: 'ring-teal-500', border: 'border-teal-500' },
  pantry: { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-50', ring: 'ring-amber-500', border: 'border-amber-500' },
  cookbook: { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-50', ring: 'ring-purple-500', border: 'border-purple-500' },
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
    'Lettuce': ['Romaine', 'Iceberg', 'Green Leaf', 'Kale', 'Spinach', 'Arugula', 'Mixed Greens', 'Other'],
    'Apples': ['Fuji', 'Gala', 'Granny Smith', 'Honeycrisp', 'Pink Lady', 'Other'],
    'Oranges': ['Navel', 'Blood Orange', 'Mandarin/Clementine', 'Valencia', 'Other'],
    'Pears': ['Bartlett', 'Bosc', "D'Anjou", 'Other'],
    'Dairy': null,
    'Produce (Other)': null,
    'Other': null,
  },
  pantry: {
    'Pasta': ['Spaghetti', 'Penne', 'Bow Tie (Farfalle)', 'Elbow', 'Fettuccine', 'Linguine', 'Angel Hair', 'Rigatoni', 'Rotini', 'Lasagna', 'Orzo', 'Other'],
    'Canned Goods': null,
    'Dry Goods': null,
    'Sauces & Condiments': null,
    'Spices': null,
    'Snacks': null,
    'Baking': null,
    'Beverages': null,
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
    'Lettuce': 'count',
    'Apples': 'count',
    'Oranges': 'count',
    'Pears': 'count',
    'Dairy': 'count',
    'Produce (Other)': 'count',
    'Other': 'count',
  },
  pantry: {
    'Pasta': 'boxes',
    'Canned Goods': 'cans',
    'Dry Goods': 'bags',
    'Sauces & Condiments': 'bottles',
    'Spices': 'jars',
    'Snacks': 'bags',
    'Baking': 'bags',
    'Beverages': 'count',
    'Other': 'count',
  },
}
