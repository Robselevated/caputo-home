import InventoryPage from '../components/InventoryPage'

export default function Fridge() {
  return (
    <InventoryPage
      location="fridge"
      title="Fridge"
      colorClass="text-section-fridge"
      bgClass="bg-section-fridge"
      lightBg="bg-section-fridge/10"
      ringClass="focus:ring-section-fridge"
      heroLabel="Cold Storage"
      heroSubtitle="Fresh items and refrigerated goods"
      heroShowStat={true}
      heroTitleInColor={true}
      gutterClass="editorial-gutter-fridge"
      sectionIcon="kitchen"
    />
  )
}
