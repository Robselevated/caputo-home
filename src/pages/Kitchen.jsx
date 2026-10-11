import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import KitchenPage from '../features/kitchen/KitchenPage'
import { isLocation, writeLastLocation } from '../features/kitchen/locationTheme'

export default function Kitchen() {
  const { location } = useParams()
  const valid = isLocation(location)
  useEffect(() => { if (valid) writeLastLocation(location) }, [location, valid])
  if (!valid) return <Navigate to="/kitchen" replace />
  return <KitchenPage location={location} />
}
