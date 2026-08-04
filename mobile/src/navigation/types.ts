export type RootStackParamList = {
  Tabs: undefined
  BillForm: { id?: string } | undefined
  BillDetail: { id: string }
  QuoteForm: { id?: string } | undefined
  QuoteDetail: { id: string }
  CustomerForm: { id?: string } | undefined
  CompanyForm: { id?: string } | undefined
  CustomersList: undefined
  CompaniesList: undefined
  Reports: undefined
  Settings: undefined
  Users: undefined
}

export type TabParamList = {
  Dashboard: undefined
  Bills: undefined
  Quotations: undefined
  More: undefined
}
