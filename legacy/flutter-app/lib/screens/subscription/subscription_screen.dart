import 'package:flutter/material.dart';
import '../../utils/app_theme.dart';

class SubscriptionPlan {
  final String id;
  final String name;
  final String emoji;
  final String price;
  final String period;
  final List<String> features;
  final Color color;
  final bool isPopular;

  const SubscriptionPlan({
    required this.id,
    required this.name,
    required this.emoji,
    required this.price,
    required this.period,
    required this.features,
    required this.color,
    this.isPopular = false,
  });
}

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  String _selectedPlan = 'silver';

  final List<SubscriptionPlan> _plans = const [
    SubscriptionPlan(
      id: 'free',
      name: 'مجاني',
      emoji: '🆓',
      price: 'مجانياً',
      period: 'دائم',
      features: [
        'إنشاء ملف شخصي',
        'تصفح الأعضاء',
        'إرسال 5 رسائل يومياً',
        'البحث الأساسي',
      ],
      color: AppTheme.textGrey,
    ),
    SubscriptionPlan(
      id: 'silver',
      name: 'فضية',
      emoji: '🥈',
      price: '29 ريال',
      period: 'شهرياً',
      features: [
        'كل مميزات المجاني',
        'رسائل غير محدودة',
        'بحث متقدم',
        'ظهور مميز في النتائج',
        'رؤية من زار ملفك',
        'دخول متخفٍ',
      ],
      color: Color(0xFF718096),
      isPopular: false,
    ),
    SubscriptionPlan(
      id: 'gold',
      name: 'ذهبية',
      emoji: '👑',
      price: '49 ريال',
      period: 'شهرياً',
      features: [
        'كل مميزات الفضية',
        'ظهور في أول النتائج',
        'شارة مميزة على الملف',
        'باحث ذكي تلقائي',
        'إحصائيات ملفك الشخصي',
        'دعم أولوية من الإدارة',
        'إمكانية رؤية صور الأعضاء',
      ],
      color: AppTheme.accentGold,
      isPopular: true,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اشتراكات نِكاح')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primaryGreen, Color(0xFF0D4A28)],
                ),
              ),
              child: Column(
                children: [
                  const Text('⭐', style: TextStyle(fontSize: 40)),
                  const SizedBox(height: 12),
                  const Text(
                    'ترقية العضوية',
                    style: TextStyle(fontFamily: 'Tajawal', fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'استمتع بمزايا إضافية وزد فرصك في إيجاد الشريك المناسب',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontFamily: 'Tajawal', color: Colors.white.withOpacity(0.85), height: 1.5),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Plans
                  ..._plans.map((plan) => _buildPlanCard(plan)),

                  const SizedBox(height: 20),

                  // Payment button
                  if (_selectedPlan != 'free')
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _handleSubscribe,
                        child: Text(
                          'اشترك الآن - ${_plans.firstWhere((p) => p.id == _selectedPlan).price}',
                          style: const TextStyle(fontFamily: 'Tajawal', fontSize: 17, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),

                  const SizedBox(height: 16),

                  // Payment methods
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.dividerColor),
                    ),
                    child: Column(
                      children: [
                        const Text('طرق الدفع المتاحة', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            _buildPaymentMethod('💳 بطاقة ائتمانية'),
                            _buildPaymentMethod('🍎 Apple Pay'),
                            _buildPaymentMethod('🟢 Google Pay'),
                            _buildPaymentMethod('🏦 تحويل بنكي'),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Guarantee
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryGreen.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      children: [
                        Text('🔒', style: TextStyle(fontSize: 24)),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'دفع آمن 100% • يمكن إلغاء الاشتراك في أي وقت • لا توجد رسوم خفية',
                            style: TextStyle(fontFamily: 'Tajawal', fontSize: 12, color: AppTheme.primaryGreen, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard(SubscriptionPlan plan) {
    final isSelected = _selectedPlan == plan.id;

    return GestureDetector(
      onTap: () => setState(() => _selectedPlan = plan.id),
      child: Stack(
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSelected ? plan.color : AppTheme.dividerColor,
                width: isSelected ? 2.5 : 1,
              ),
              boxShadow: [
                if (isSelected)
                  BoxShadow(
                    color: plan.color.withOpacity(0.2),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(plan.emoji, style: const TextStyle(fontSize: 28)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'العضوية ${plan.name}',
                            style: TextStyle(
                              fontFamily: 'Tajawal',
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: plan.color,
                            ),
                          ),
                          Text(
                            '${plan.price} / ${plan.period}',
                            style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: isSelected ? plan.color : AppTheme.dividerColor, width: 2),
                        color: isSelected ? plan.color : Colors.transparent,
                      ),
                      child: isSelected
                          ? const Icon(Icons.check, color: Colors.white, size: 14)
                          : null,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1, color: AppTheme.dividerColor),
                const SizedBox(height: 12),
                ...plan.features.map(
                  (feature) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle, color: plan.color, size: 16),
                        const SizedBox(width: 8),
                        Text(feature, style: const TextStyle(fontFamily: 'Tajawal', fontSize: 13, color: AppTheme.textDark)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (plan.isPopular)
            Positioned(
              top: 12,
              left: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: plan.color,
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(8),
                    bottomRight: Radius.circular(8),
                  ),
                ),
                child: const Text('الأكثر اختياراً', style: TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'Tajawal', fontWeight: FontWeight.bold)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethod(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.dividerColor),
      ),
      child: Text(label, style: const TextStyle(fontFamily: 'Tajawal', fontSize: 12, color: AppTheme.textDark)),
    );
  }

  void _handleSubscribe() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('تأكيد الاشتراك', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold)),
        content: Text(
          'ستشترك في العضوية ${_plans.firstWhere((p) => p.id == _selectedPlan).name} مقابل ${_plans.firstWhere((p) => p.id == _selectedPlan).price} شهرياً.',
          style: const TextStyle(fontFamily: 'Tajawal', height: 1.6),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Tajawal'))),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('تأكيد', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }
}
