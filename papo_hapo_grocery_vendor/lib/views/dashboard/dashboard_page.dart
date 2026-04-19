import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons_flutter.dart';
import 'package:fl_chart/fl_chart.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Habari, Grocery Shop Owner',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'Hapa kuna muhtasari wa biashara yako leo.',
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
              // Search & Profile
              Row(
                children: [
                  Container(
                    width: 300,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF141414),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const TextField(
                      decoration: InputDecoration(
                        icon: Icon(LucideIcons.search, size: 20, color: Colors.grey),
                        hintText: 'Tafuta kitu chochote...',
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  const CircleAvatar(
                    backgroundImage: NetworkImage('https://picsum.photos/seed/vendor/100'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 40),
          
          // KPI Cards
          Row(
            children: [
              _KpiCard(label: 'Mauzo ya Leo', value: 'TZS 450,000', trend: '+12%', icon: LucideIcons.trendingUp, trendColor: Colors.green),
              const SizedBox(width: 24),
              _KpiCard(label: 'Oda Mpya', value: '24', trend: 'Online', icon: LucideIcons.shoppingBag, trendColor: Colors.blue),
              const SizedBox(width: 24),
              _KpiCard(label: 'Bidhaa Zinazoisha', value: '8 kg', trend: 'Re-stock', icon: LucideIcons.alertTriangle, trendColor: Colors.red),
              const SizedBox(width: 24),
              _KpiCard(label: 'Mauzo ya Mwezi', value: 'TZS 12.4M', trend: '+5.2%', icon: LucideIcons.barChart2, trendColor: Colors.green),
            ],
          ),
          
          const SizedBox(height: 40),
          
          // Sales Chart
          Container(
            height: 400,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF141414),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Mwenendo wa Mauzo (Sales Analytics)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 40),
                Expanded(
                  child: LineChart(
                    LineChartData(
                      gridData: const FlGridData(show: false),
                      titlesData: const FlTitlesData(show: true),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [
                        LineChartBarData(
                          isCurved: true,
                          color: const Color(0xFFBCFF4B),
                          barWidth: 4,
                          isStrokeCapRound: true,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color: const Color(0xFFBCFF4B).withOpacity(0.1),
                          ),
                          spots: const [
                            FlSpot(0, 3),
                            FlSpot(2.6, 2),
                            FlSpot(4.9, 5),
                            FlSpot(6.8, 3.1),
                            FlSpot(8, 4),
                            FlSpot(9.5, 3),
                            FlSpot(11, 4),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String trend;
  final IconData icon;
  final Color trendColor;

  const _KpiCard({required this.label, required this.value, required this.trend, required this.icon, required this.trendColor});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: const Color(0xFF141414),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: const Color(0xFFBCFF4B), size: 20),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: trendColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    trend,
                    style: TextStyle(color: trendColor, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.black)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
