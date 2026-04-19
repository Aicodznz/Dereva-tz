import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons_flutter.dart';
import '../controllers/navigation_controller.dart';
import 'dashboard/dashboard_page.dart';
import 'pos/pos_page.dart';

class MainLayout extends StatelessWidget {
  const MainLayout({super.key});

  @override
  Widget build(BuildContext context) {
    final navCtrl = Get.find<NavigationController>();

    return Scaffold(
      body: Row(
        children: [
          // Sidebar
          Sidebar(),
          // Main Content
          Expanded(
            child: Obx(() => _buildPage(navCtrl.selectedIndex.value)),
          ),
        ],
      ),
    );
  }

  Widget _buildPage(int index) {
    switch (index) {
      case 0: return const DashboardPage();
      case 1: return const Center(child: Text('Inventory Management'));
      case 2: return const Center(child: Text('Online Orders'));
      case 3: return const PosPage();
      default: return const DashboardPage();
    }
  }
}

class Sidebar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final navCtrl = Get.find<NavigationController>();
    
    return Container(
      width: 280,
      decoration: BoxDecoration(
        color: const Color(0xFF141414),
        border: Border(right: BorderSide(color: Colors.white.withOpacity(0.05))),
      ),
      child: Column(
        children: [
          const SizedBox(height: 32),
          // Logo
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFBCFF4B),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(LucideIcons.shoppingBag, color: Colors.black, size: 24),
                ),
                const SizedBox(width: 12),
                const Text(
                  'PAPO HAPO',
                  style: TextStyle(
                    fontWeight: FontWeight.black,
                    letterSpacing: 1.5,
                    fontSize: 20,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
          _NavItem(title: 'Dashibodi', icon: LucideIcons.home, index: 0),
          _NavItem(title: 'Bidhaa', icon: LucideIcons.box, index: 1),
          _NavItem(title: 'Oda', icon: LucideIcons.receipt, index: 2),
          _NavItem(title: 'POS (Mauzo)', icon: LucideIcons.calculator, index: 3),
          _NavItem(title: 'Ripoti', icon: LucideIcons.barChart3, index: 4),
          _NavItem(title: 'Wateja', icon: LucideIcons.users, index: 5),
          const Spacer(),
          _NavItem(title: 'Mipangilio', icon: LucideIcons.settings, index: 6),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final String title;
  final IconData icon;
  final int index;

  const _NavItem({required this.title, required this.icon, required this.index});

  @override
  Widget build(BuildContext context) {
    final navCtrl = Get.find<NavigationController>();

    return Obx(() {
      bool isSelected = navCtrl.selectedIndex.value == index;
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: InkWell(
          onTap: () => navCtrl.changeIndex(index),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFFBCFF4B).withOpacity(0.1) : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isSelected ? const Color(0xFFBCFF4B) : Colors.white.withOpacity(0.5),
                ),
                const SizedBox(width: 12),
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    color: isSelected ? const Color(0xFFBCFF4B) : Colors.white.withOpacity(0.5),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }
}
