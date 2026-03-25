import InventoryPage from '../components/InventoryPage'

export default function Freezer() {
  return (
    <InventoryPage
      location="freezer"
      title="Freezer"
      colorClass="text-section-freezer"
      bgClass="bg-section-freezer"
      lightBg="bg-section-freezer/10"
      ringClass="focus:ring-section-freezer"
      heroSubtitle="Your frozen inventory at a glance"
      heroShowStat={true}
      heroTitleInColor={false}
      gutterClass="editorial-gutter-freezer"
      sectionIcon="ac_unit"
    />
  )
}
