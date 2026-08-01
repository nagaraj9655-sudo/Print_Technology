import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bills from './pages/Bills'
import BillForm from './pages/BillForm'
import BillDetail from './pages/BillDetail'
import Quotations from './pages/Quotations'
import QuoteForm from './pages/QuoteForm'
import QuoteDetail from './pages/QuoteDetail'
import Customers from './pages/Customers'
import Companies from './pages/Companies'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Users from './pages/Users'

export default function App() {
  const { currentUser } = useStore()

  if (!currentUser) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/bills/new" element={<BillForm />} />
        <Route path="/bills/:id" element={<BillDetail />} />
        <Route path="/bills/:id/edit" element={<BillForm />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/quotations/new" element={<QuoteForm />} />
        <Route path="/quotations/:id" element={<QuoteDetail />} />
        <Route path="/quotations/:id/edit" element={<QuoteForm />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/users" element={<Users />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
