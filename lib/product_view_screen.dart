import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

/// Enum to define product categories for adaptive UI
enum PapoHapoCategory { food, grocery, pharmacy, hotel, carRental }

/// Controller to manage the state of the Product View Screen
class ProductController extends GetxController {
  final PapoHapoCategory category;
  
  // Basic State
  var quantity = 1.obs;
  var isDescriptionExpanded = false.obs;
  var currentImageIndex = 0.obs;

  // Food Options
  var selectedSize = 'Normal'.obs;
  var selectedAddons = <String>{}.obs;

  // Hotel/Car Options
  var checkInDate = DateTime.now().obs;
  var checkOutDate = DateTime.now().add(const Duration(days: 1)).obs;
  var adults = 1.obs;
  var children = 0.obs;

  ProductController({required this.category});

  void incrementQuantity() => quantity.value++;
  void decrementQuantity() {
    if (quantity.value > 1) quantity.value--;
  }

  void toggleDescription() => isDescriptionExpanded.value = !isDescriptionExpanded.value;

  void toggleAddon(String addon) {
    if (selectedAddons.contains(addon)) {
      selectedAddons.remove(addon);
    } else {
      selectedAddons.add(addon);
    }
  }

  String get actionButtonText {
    switch (category) {
      case PapoHapoCategory.hotel:
      case PapoHapoCategory.carRental:
        return 'Weka Booking Sasa • TSh 250,000';
      default:
        return 'Ongeza Kwenye Kapu • TSh 12,000';
    }
  }
}

class ProductViewScreen extends StatelessWidget {
  final PapoHapoCategory category;
  late final ProductController controller;

  ProductViewScreen({super.key, required this.category}) {
    controller = Get.put(ProductController(category: category), tag: category.toString());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // Main Content
          CustomScrollView(
            slivers: [
              _buildImageGallery(),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildCoreInfo(),
                      const SizedBox(height: 24),
                      _buildDescription(),
                      const SizedBox(height: 24),
                      _buildAdaptiveOptions(),
                      const SizedBox(height: 100), // Space for bottom bar
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Sticky Bottom Bar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildBottomActionBar(),
          ),

          // Back Button Overlay
          Positioned(
            top: MediaQuery.of(context).padding.top + 10,
            left: 16,
            child: CircleAvatar(
              backgroundColor: Colors.black.withOpacity(0.3),
              child: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => Get.back(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImageGallery() {
    return SliverAppBar(
      expandedHeight: 350,
      automaticallyImplyLeading: false,
      backgroundColor: Colors.transparent,
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          children: [
            PageView.builder(
              onPageChanged: (index) => controller.currentImageIndex.value = index,
              itemCount: 3,
              itemBuilder: (context, index) {
                return Image.network(
                  'https://picsum.photos/seed/${category.name}$index/800/800',
                  fit: BoxFit.cover,
                );
              },
            ),
            Positioned(
              bottom: 20,
              left: 0,
              right: 0,
              child: Obx(() => Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(3, (index) {
                      return Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: controller.currentImageIndex.value == index
                              ? Colors.orange
                              : Colors.white.withOpacity(0.5),
                        ),
                      );
                    }),
                  )),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCoreInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                category == PapoHapoCategory.food ? 'Wali Kuku wa Nazi' : 'Product Name Here',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black),
              ),
            ),
            const Text(
              'TSh 12,000',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.orange),
            ),
          ],
        ),
        const SizedBox(height: 4),
        GestureDetector(
          onTap: () => print('Navigate to Vendor'),
          child: Text(
            'by Mangi\'s Restaurant',
            style: TextStyle(fontSize: 14, color: Colors.grey[600], decoration: TextDecoration.underline),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            const Icon(Icons.star, color: Colors.orange, size: 18),
            const SizedBox(width: 4),
            const Text('4.8', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(width: 8),
            Text('(215 reviews)', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
          ],
        ),
      ],
    );
  }

  Widget _buildDescription() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Maelezo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Obx(() => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hii ni bidhaa bora kabisa inayopatikana Papo Hapo. Imetengenezwa kwa weledi na ubora wa hali ya juu ili kukidhi mahitaji yako ya kila siku. '
                  'Tunaahidi kutoa huduma bora na ya haraka popote ulipo jijini Dar es Salaam na mikoa jirani.',
                  maxLines: controller.isDescriptionExpanded.value ? null : 3,
                  overflow: controller.isDescriptionExpanded.value ? TextOverflow.visible : TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.grey[700], height: 1.5),
                ),
                GestureDetector(
                  onTap: controller.toggleDescription,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                    child: Text(
                      controller.isDescriptionExpanded.value ? 'Read Less' : 'Read More',
                      style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            )),
      ],
    );
  }

  Widget _buildAdaptiveOptions() {
    switch (category) {
      case PapoHapoCategory.food:
        return _buildFoodOptions();
      case PapoHapoCategory.grocery:
        return _buildGroceryOptions();
      case PapoHapoCategory.pharmacy:
        return _buildPharmacyOptions();
      case PapoHapoCategory.hotel:
        return _buildHotelOptions();
      case PapoHapoCategory.carRental:
        return _buildCarRentalOptions();
    }
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildFoodOptions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Chagua Vionjo'),
        const Text('Ukubwa (Size)', style: TextStyle(fontWeight: FontWeight.w600)),
        Obx(() => Row(
              children: [
                Radio<String>(
                  value: 'Normal',
                  groupValue: controller.selectedSize.value,
                  onChanged: (val) => controller.selectedSize.value = val!,
                  activeColor: Colors.orange,
                ),
                const Text('Normal'),
                const SizedBox(width: 20),
                Radio<String>(
                  value: 'Large',
                  groupValue: controller.selectedSize.value,
                  onChanged: (val) => controller.selectedSize.value = val!,
                  activeColor: Colors.orange,
                ),
                const Text('Large'),
              ],
            )),
        const SizedBox(height: 12),
        const Text('Vionjo (Add-ons)', style: TextStyle(fontWeight: FontWeight.w600)),
        ...['Pilipili', 'Ndizi', 'Saladi'].map((addon) => Obx(() => CheckboxListTile(
              title: Text(addon),
              value: controller.selectedAddons.contains(addon),
              onChanged: (_) => controller.toggleAddon(addon),
              activeColor: Colors.orange,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
            ))),
      ],
    );
  }

  Widget _buildGroceryOptions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Chagua Kiasi'),
        Text('Inauzwa kwa kilo au kiasi unachohitaji.', style: TextStyle(color: Colors.grey[600])),
      ],
    );
  }

  Widget _buildPharmacyOptions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Taarifa Muhimu'),
        _buildInfoRow('Aina ya Dawa', 'Over-the-counter'),
        _buildInfoRow('Expiry Date', 'Inaisha tarehe: 12/2028'),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.upload_file),
            label: const Text('Pakia Prescription Yako Hapa'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue[50],
              foregroundColor: Colors.blue[800],
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600])),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildHotelOptions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Weka Tarehe Zako'),
        Row(
          children: [
            Expanded(child: _buildDatePicker('Check-in', controller.checkInDate)),
            const SizedBox(width: 16),
            Expanded(child: _buildDatePicker('Check-out', controller.checkOutDate)),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: _buildCounter('Adults', controller.adults)),
            const SizedBox(width: 16),
            Expanded(child: _buildCounter('Children', controller.children)),
          ],
        ),
      ],
    );
  }

  Widget _buildCarRentalOptions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Weka Muda wa Kukodi'),
        _buildDatePicker('Pickup Date & Time', controller.checkInDate, showTime: true),
        const SizedBox(height: 12),
        _buildDatePicker('Drop-off Date & Time', controller.checkOutDate, showTime: true),
      ],
    );
  }

  Widget _buildDatePicker(String label, Rx<DateTime> date, {bool showTime = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        InkWell(
          onTap: () async {
            final picked = await showDatePicker(
              context: Get.context!,
              initialDate: date.value,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (picked != null) date.value = picked;
          },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey[300]!),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today, size: 16, color: Colors.orange),
                const SizedBox(width: 8),
                Obx(() => Text(
                      showTime 
                        ? DateFormat('dd MMM, hh:mm a').format(date.value)
                        : DateFormat('dd MMM, yyyy').format(date.value),
                      style: const TextStyle(fontSize: 13),
                    )),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCounter(String label, RxInt count) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(onPressed: () => count.value > 0 ? count.value-- : null, icon: const Icon(Icons.remove, size: 16)),
              Obx(() => Text('${count.value}')),
              IconButton(onPressed: () => count.value++, icon: const Icon(Icons.add, size: 16)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBottomActionBar() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5)),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Quantity Selector
            Container(
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: controller.decrementQuantity,
                    icon: const Icon(Icons.remove, size: 20),
                  ),
                  Obx(() => Text(
                        '${controller.quantity.value}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      )),
                  IconButton(
                    onPressed: controller.incrementQuantity,
                    icon: const Icon(Icons.add, size: 20),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            // Add to Cart Button
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  Get.snackbar(
                    'Hongera!',
                    'Bidhaa imeongezwa kwenye kapu lako.',
                    snackPosition: SnackPosition.TOP,
                    backgroundColor: Colors.green,
                    colorText: Colors.white,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: Text(
                  controller.actionButtonText,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
