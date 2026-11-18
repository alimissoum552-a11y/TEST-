import { lazy, Suspense } from 'react'

// A component loaded only when it is first shown, so the first page load stays small.
// The fallback is empty: panels open over the app, which stays visible while the code arrives.
export default function lazyPanel(load, fallback = null) {
  const Component = lazy(load)
  return function LazyPanel(props) {
    return <Suspense fallback={fallback}><Component {...props} /></Suspense>
  }
}
