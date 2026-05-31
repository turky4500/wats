import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../utils/app_theme.dart';
import '../../providers/auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final PageController _pageController = PageController();
  int _currentStep = 0;
  final int _totalSteps = 4;

  // Step 1 - Basic Info
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _usernameController = TextEditingController();
  String _gender = 'male';

  // Step 2 - Personal Info
  int _age = 25;
  String _nationality = 'السعودية';
  String _country = 'السعودية';
  String _maritalStatus = 'single';

  // Step 3 - Religious Info
  String _religiousLevel = 'committed';
  String _beard = 'yes';
  String _hijab = 'hijab';

  // Step 4 - Guardian Info (for females)
  final _guardianNameController = TextEditingController();
  final _guardianPhoneController = TextEditingController();
  String _guardianRelation = 'أب';

  bool _agreedToTerms = false;

  final List<String> _nationalities = [
    'السعودية', 'الإمارات', 'الكويت', 'البحرين', 'قطر', 'عُمان',
    'مصر', 'الأردن', 'سوريا', 'لبنان', 'العراق', 'اليمن',
    'المغرب', 'الجزائر', 'تونس', 'ليبيا', 'السودان', 'الصومال',
    'فلسطين', 'باكستان', 'إندونيسيا', 'تركيا', 'ماليزيا', 'أخرى'
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundCream,
      appBar: AppBar(
        title: Text('إنشاء حساب - الخطوة ${_currentStep + 1} من $_totalSteps'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_currentStep > 0) {
              _pageController.previousPage(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            } else {
              context.go('/login');
            }
          },
        ),
      ),
      body: Column(
        children: [
          // Progress bar
          Container(
            color: AppTheme.primaryGreen,
            padding: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
            child: Row(
              children: List.generate(_totalSteps, (index) {
                return Expanded(
                  child: Container(
                    height: 4,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: index <= _currentStep
                          ? Colors.white
                          : Colors.white.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }),
            ),
          ),
          // Pages
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (index) => setState(() => _currentStep = index),
              children: [
                _buildStep1(),
                _buildStep2(),
                _buildStep3(),
                _buildStep4(),
              ],
            ),
          ),
          // Next Button
          Padding(
            padding: const EdgeInsets.all(20),
            child: Consumer<AuthProvider>(
              builder: (context, auth, _) {
                return SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: auth.isLoading ? null : _handleNext,
                    child: auth.isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(
                            _currentStep < _totalSteps - 1 ? 'التالي' : 'إنشاء الحساب',
                            style: const TextStyle(
                              fontFamily: 'Tajawal',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep1() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('معلومات الحساب', style: TextStyle(fontFamily: 'Tajawal', fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 6),
          const Text('سيتم استخدامها لتسجيل الدخول', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey)),
          const SizedBox(height: 24),
          // Gender selector
          const Text('الجنس:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _gender = 'male'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: _gender == 'male' ? AppTheme.primaryGreen : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.primaryGreen),
                    ),
                    child: Column(
                      children: [
                        const Text('👨', style: TextStyle(fontSize: 28)),
                        const SizedBox(height: 4),
                        Text(
                          'رجل',
                          style: TextStyle(
                            fontFamily: 'Tajawal',
                            fontWeight: FontWeight.bold,
                            color: _gender == 'male' ? Colors.white : AppTheme.primaryGreen,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _gender = 'female'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: _gender == 'female' ? AppTheme.primaryGreen : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.primaryGreen),
                    ),
                    child: Column(
                      children: [
                        const Text('👩', style: TextStyle(fontSize: 28)),
                        const SizedBox(height: 4),
                        Text(
                          'امرأة',
                          style: TextStyle(
                            fontFamily: 'Tajawal',
                            fontWeight: FontWeight.bold,
                            color: _gender == 'female' ? Colors.white : AppTheme.primaryGreen,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _usernameController,
            decoration: const InputDecoration(
              labelText: 'الاسم المستعار',
              hintText: 'مثال: أبو عبدالله',
              prefixIcon: Icon(Icons.person_outline, color: AppTheme.primaryGreen),
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(
              labelText: 'البريد الإلكتروني',
              prefixIcon: Icon(Icons.email_outlined, color: AppTheme.primaryGreen),
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(
              labelText: 'كلمة المرور',
              hintText: 'على الأقل 8 أحرف',
              prefixIcon: Icon(Icons.lock_outlined, color: AppTheme.primaryGreen),
            ),
          ),
          const SizedBox(height: 20),
          // Terms
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.lightGold.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.accentGold.withOpacity(0.4)),
            ),
            child: Row(
              children: [
                Checkbox(
                  value: _agreedToTerms,
                  onChanged: (val) => setState(() => _agreedToTerms = val!),
                  activeColor: AppTheme.primaryGreen,
                ),
                Expanded(
                  child: Text(
                    'أوافق على أن التطبيق للزواج الشرعي فقط، وأتعهد بعدم الإساءة أو انتهاك الشريعة الإسلامية',
                    style: const TextStyle(fontFamily: 'Tajawal', fontSize: 13, color: AppTheme.textDark),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('المعلومات الشخصية', style: TextStyle(fontFamily: 'Tajawal', fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 24),
          // Age
          Row(
            children: [
              const Expanded(
                child: Text('العمر:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark, fontSize: 16)),
              ),
              Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() { if (_age > 18) _age--; }),
                    icon: const Icon(Icons.remove_circle_outline, color: AppTheme.primaryGreen),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$_age سنة',
                      style: const TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.primaryGreen),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() { if (_age < 70) _age++; }),
                    icon: const Icon(Icons.add_circle_outline, color: AppTheme.primaryGreen),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Nationality
          DropdownButtonFormField<String>(
            value: _nationality,
            decoration: const InputDecoration(
              labelText: 'الجنسية',
              prefixIcon: Icon(Icons.flag_outlined, color: AppTheme.primaryGreen),
            ),
            items: _nationalities.map((n) => DropdownMenuItem(value: n, child: Text(n, style: const TextStyle(fontFamily: 'Tajawal')))).toList(),
            onChanged: (val) => setState(() => _nationality = val!),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            value: _country,
            decoration: const InputDecoration(
              labelText: 'مكان الإقامة',
              prefixIcon: Icon(Icons.location_on_outlined, color: AppTheme.primaryGreen),
            ),
            items: _nationalities.map((n) => DropdownMenuItem(value: n, child: Text(n, style: const TextStyle(fontFamily: 'Tajawal')))).toList(),
            onChanged: (val) => setState(() => _country = val!),
          ),
          const SizedBox(height: 20),
          const Text('الحالة الاجتماعية:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              _buildChoiceChip('أعزب/عازبة', 'single'),
              _buildChoiceChip('مطلق/مطلقة', 'divorced'),
              _buildChoiceChip('أرمل/أرملة', 'widowed'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChoiceChip(String label, String value) {
    final isSelected = _maritalStatus == value;
    return GestureDetector(
      onTap: () => setState(() => _maritalStatus = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryGreen : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTheme.primaryGreen),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Tajawal',
            color: isSelected ? Colors.white : AppTheme.primaryGreen,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildStep3() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('المستوى الديني', style: TextStyle(fontFamily: 'Tajawal', fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 6),
          const Text('هذه المعلومات تساعد في إيجاد الشريك المناسب', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey)),
          const SizedBox(height: 24),
          const Text('درجة الالتزام الديني:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 12),
          _buildReligiousOption('ملتزم/ة', 'committed', '🕌', 'يؤدي الفرائض ويتجنب المحرمات'),
          _buildReligiousOption('متوسط الالتزام', 'moderate', '📿', 'يحاول الالتزام بالفرائض الأساسية'),
          _buildReligiousOption('مسلم/ة', 'basic', '☪️', 'مسلم بالهوية'),
          const SizedBox(height: 20),
          if (_gender == 'male') ...[
            const Text('هل لديك لحية:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
            const SizedBox(height: 10),
            Row(
              children: [
                _buildSimpleChip('نعم', 'yes', _beard, (v) => setState(() => _beard = v)),
                const SizedBox(width: 10),
                _buildSimpleChip('لا', 'no', _beard, (v) => setState(() => _beard = v)),
              ],
            ),
          ],
          if (_gender == 'female') ...[
            const Text('الحجاب:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                _buildSimpleChip('نقاب', 'niqab', _hijab, (v) => setState(() => _hijab = v)),
                _buildSimpleChip('حجاب', 'hijab', _hijab, (v) => setState(() => _hijab = v)),
                _buildSimpleChip('غير محجبة', 'none', _hijab, (v) => setState(() => _hijab = v)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildReligiousOption(String label, String value, String emoji, String desc) {
    final isSelected = _religiousLevel == value;
    return GestureDetector(
      onTap: () => setState(() => _religiousLevel = value),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryGreen.withOpacity(0.08) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.primaryGreen : AppTheme.dividerColor,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                  Text(desc, style: const TextStyle(fontFamily: 'Tajawal', fontSize: 12, color: AppTheme.textGrey)),
                ],
              ),
            ),
            if (isSelected) const Icon(Icons.check_circle, color: AppTheme.primaryGreen),
          ],
        ),
      ),
    );
  }

  Widget _buildSimpleChip(String label, String value, String currentValue, void Function(String) onTap) {
    final isSelected = currentValue == value;
    return GestureDetector(
      onTap: () => onTap(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryGreen : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTheme.primaryGreen),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Tajawal',
            color: isSelected ? Colors.white : AppTheme.primaryGreen,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildStep4() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('اكتمال التسجيل', style: TextStyle(fontFamily: 'Tajawal', fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 24),
          if (_gender == 'female') ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.lightGold.withOpacity(0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.accentGold.withOpacity(0.5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Text('👨‍👩‍👧', style: TextStyle(fontSize: 20)),
                      SizedBox(width: 8),
                      Text('بيانات ولي الأمر', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark, fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'التواصل مع وليّك أمر ضروري لضمان سير الخطبة وفق الشريعة',
                    style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _guardianNameController,
                    decoration: const InputDecoration(labelText: 'اسم ولي الأمر'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _guardianPhoneController,
                    keyboardType: TextInputType.phone,
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(labelText: 'رقم هاتف ولي الأمر'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _guardianRelation,
                    decoration: const InputDecoration(labelText: 'صلة القرابة'),
                    items: ['أب', 'أخ', 'عم', 'خال', 'ابن'].map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontFamily: 'Tajawal')))).toList(),
                    onChanged: (val) => setState(() => _guardianRelation = val!),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          // Summary box
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withOpacity(0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.primaryGreen.withOpacity(0.3)),
            ),
            child: Column(
              children: [
                const Icon(Icons.verified_outlined, color: AppTheme.primaryGreen, size: 40),
                const SizedBox(height: 12),
                const Text(
                  'سيتم مراجعة حسابك',
                  style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textDark),
                ),
                const SizedBox(height: 8),
                const Text(
                  'تقوم الإدارة بمراجعة جميع الحسابات الجديدة للتحقق من الجدية والالتزام بالشروط. سيتم إخطارك عند اعتماد حسابك.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, height: 1.6),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('⚠️ تنبيه مهم:', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                SizedBox(height: 6),
                Text(
                  '• هذا التطبيق للزواج الشرعي فقط\n• ممنوع تبادل الأرقام مباشرة\n• ممنوع أي محادثة خارج التطبيق\n• المخالفة تؤدي إلى حظر الحساب فوراً',
                  style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textDark, height: 1.8, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleNext() async {
    if (_currentStep < _totalSteps - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      final auth = context.read<AuthProvider>();
      final success = await auth.register(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        username: _usernameController.text.trim(),
        gender: _gender,
        age: _age,
        nationality: _nationality,
        country: _country,
      );
      if (success && mounted) {
        context.go('/home');
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _usernameController.dispose();
    _guardianNameController.dispose();
    _guardianPhoneController.dispose();
    _pageController.dispose();
    super.dispose();
  }
}
