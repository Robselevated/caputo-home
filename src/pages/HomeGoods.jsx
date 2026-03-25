import InventoryPage from '../components/InventoryPage'

export default function HomeGoods() {
  return (
    <InventoryPage
      location="home_goods"
      title="Home Essentials"
      colorClass="text-section-homegoods"
      bgClass="bg-section-homegoods"
      lightBg="bg-section-homegoods/10"
      ringClass="focus:ring-section-homegoods"
      heroLabel="Household Inventory"
      heroAccentWord="Essentials"
      heroSubtitle="Cleaning supplies, paper goods, and household basics"
      heroShowStat={false}
      heroTitleInColor={false}
      gutterClass="editorial-gutter-homegoods"
      sectionIcon="home"
    />
  )
}
