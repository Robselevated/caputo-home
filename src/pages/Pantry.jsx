import InventoryPage from '../components/InventoryPage'

export default function Pantry() {
  return (
    <InventoryPage
      location="pantry"
      title="Pantry Inventory"
      colorClass="text-section-pantry"
      bgClass="bg-section-pantry"
      lightBg="bg-section-pantry/10"
      ringClass="focus:ring-section-pantry"
      heroLabel="Storage Center"
      heroAccentWord="Inventory"
      heroSubtitle="Track your dry goods, snacks, and staples"
      heroShowStat={false}
      heroTitleInColor={false}
      gutterClass="editorial-gutter-pantry"
      sectionIcon="inventory_2"
    />
  )
}
