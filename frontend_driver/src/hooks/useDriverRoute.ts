import { useRouteContext } from '../context/RouteContext';

export function useDriverRoute() {
  return useRouteContext();
}

export default useDriverRoute;
