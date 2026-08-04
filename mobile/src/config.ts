// Supabase connection for the Magizhini mobile app.
// The anon key is a *public* client key — safe to ship in an app; Postgres RLS
// is what protects the data. Never put the service_role key here.
//
// URL was derived from the anon key's JWT `ref` claim (ugxguxzrqalxboegsxzr).
// To point the app at a different project, change these two values.

export const SUPABASE_URL = 'https://ugxguxzrqalxboegsxzr.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneGd1eHpycWFseGJvZWdzeHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODUzMjAsImV4cCI6MjEwMTE2MTMyMH0.075jZlKP7jp7cQzTo52EXgakUxcOzchwDI7u4QBCDPU'
