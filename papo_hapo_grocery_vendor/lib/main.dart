import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_fonts/google_fonts.dart';
import 'views/main_layout.dart';
import 'controllers/navigation_controller.dart';
import 'controllers/product_controller.dart';
import 'controllers/pos_controller.dart';

void main() {
  // Initialize Controllers
  Get.put(NavigationController());
  Get.put(ProductController());
  Get.put(PosController());
  
  runApp(const PapoHapoVendorApp());
}

class PapoHapoVendorApp extends StatelessWidget {
  const PapoHapoVendorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'Papo Hapo Grocery Vendor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        primaryColor: const Color(0xFFBCFF4B), // Lime Green
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFBCFF4B),
          brightness: Brightness.dark,
          surface: const Color(0xFF141414),
          primary: const Color(0xFFBCFF4B),
        ),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        cardTheme: CardTheme(
          color: const Color(0xFF141414),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.white.withOpacity(0.05)),
          ),
        ),
      ),
      home: const MainLayout(),
    );
  }
}
