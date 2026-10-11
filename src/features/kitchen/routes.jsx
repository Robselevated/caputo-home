import { Route, Navigate } from 'react-router-dom'
import Kitchen from '../../pages/Kitchen'
import { readLastLocation } from './locationTheme'

function KitchenIndex() {
  return <Navigate to={`/kitchen/${readLastLocation()}`} replace />
}

// /kitchen (last-used location), /kitchen/:location, and the pre-Kitchen
// paths that bookmarks and the old nav still point at.
export function kitchenRoutes() {
  return (
    <>
      <Route path="/kitchen" element={<KitchenIndex />} />
      <Route path="/kitchen/:location" element={<Kitchen />} />
      <Route path="/fridge" element={<Navigate to="/kitchen/fridge" replace />} />
      <Route path="/freezer" element={<Navigate to="/kitchen/freezer" replace />} />
      <Route path="/pantry" element={<Navigate to="/kitchen/pantry" replace />} />
    </>
  )
}
