import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function deleteTestOrder() {
  console.log("Fetching recent orders...")
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error("Error fetching orders:", error)
    return
  }

  const testOrders = orders.filter(o => 
    o.customer_name?.toLowerCase().includes('test') || 
    (o.grand_total === 120) || 
    o.status === 'completed' || o.status === 'served'
  )
  console.log("Recent 5 orders:", orders.slice(0, 5).map(o => ({ id: o.id, customer: o.customer_name, total: o.grand_total, created_at: o.created_at })))


  if (testOrders.length === 0) {
    console.log("No test orders found in the recent 10 orders.")
    return
  }

  for (const order of testOrders) {
    console.log(`Deleting test order ID: ${order.id} (Customer: ${order.customer_name})`)
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id)

    if (deleteError) {
      console.error(`Error deleting order ${order.id}:`, deleteError)
    } else {
      console.log(`Successfully deleted order ${order.id}`)
    }
  }
}

deleteTestOrder()
