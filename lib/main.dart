import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'product_view_screen.dart';

void main() {
  runApp(const PapoHapoApp());
}

class PapoHapoApp extends StatelessWidget {
  const PapoHapoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'Papo Hapo Super App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.orange,
        fontFamily: 'Inter',
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Papo Hapo Demo'),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCategoryTile('Chakula (Food)', PapoHapoCategory.food, Icons.restaurant),
          _buildCategoryTile('Sokoni (Grocery)', PapoHapoCategory.grocery, Icons.shopping_cart),
          _buildCategoryTile('Duka la Dawa (Pharmacy)', PapoHapoCategory.pharmacy, Icons.medical_services),
          _buildCategoryTile('Hoteli (Hotel)', PapoHapoCategory.hotel, Icons.hotel),
          _buildCategoryTile('Gari (Car Rental)', PapoHapoCategory.carRental, Icons.directions_car),
        ],
      ),
    );
  }

  Widget _buildCategoryTile(String title, PapoHapoCategory category, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: Colors.orange),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Get.to(() => ProductViewScreen(category: category)),
      ),
    );
  }
}
