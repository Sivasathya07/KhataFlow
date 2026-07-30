export const snapshotMetrics = [
  { label: "Today's revenue", value: "₹24,580", change: "+12.5%", tone: "emerald" },
  { label: "Estimated profit", value: "₹6,940", change: "+8.2%", tone: "violet" },
  { label: "Inventory value", value: "₹1.84L", change: "428 items", tone: "sky" },
  { label: "Pending credit", value: "₹12,700", change: "8 customers", tone: "amber" },
] as const;

export const insights = [
  { title: "Restock premium rice soon", description: "Sales are 28% above the usual weekly pace. You may run out in 3 days.", confidence: 94, action: "Plan reorder", tone: "violet" },
  { title: "Follow up with Ravi", description: "His credit balance is due today. A gentle WhatsApp reminder is ready.", confidence: 88, action: "Review reminder", tone: "amber" },
  { title: "Weekend demand signal", description: "Cold drink demand is trending up near your store after 6 PM.", confidence: 81, action: "See forecast", tone: "sky" },
] as const;

export const inventoryAlerts = [
  { product: "Aashirvaad Atta 5 kg", stock: "3 packs left", status: "Critical", tone: "red" },
  { product: "Tata Salt 1 kg", stock: "6 packs left", status: "Low stock", tone: "amber" },
  { product: "Coca-Cola 750 ml", stock: "11 bottles left", status: "Reorder soon", tone: "sky" },
] as const;

export const recentTransactions = [
  { name: "Walk-in sale", type: "Voice entry", time: "2 min ago", amount: "+₹1,240", tone: "emerald" },
  { name: "Sharma Traders", type: "Receipt scanned", time: "34 min ago", amount: "-₹8,450", tone: "slate" },
  { name: "Ravi Kumar", type: "Credit payment", time: "1 hr ago", amount: "+₹2,000", tone: "emerald" },
  { name: "Walk-in sale", type: "Manual entry", time: "2 hrs ago", amount: "+₹680", tone: "emerald" },
] as const;
