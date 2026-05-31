import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../utils/app_theme.dart';

class OnboardingPage {
  final String emoji;
  final String title;
  final String description;
  final Color bgColor;

  const OnboardingPage({
    required this.emoji,
    required this.title,
    required this.description,
    required this.bgColor,
  });
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<OnboardingPage> _pages = [
    const OnboardingPage(
      emoji: '🕌',
      title: 'زواج شرعي إسلامي',
      description: 'منصة متخصصة للزواج الشرعي فقط،\nلا مجال للتعارف أو العلاقات المحرمة.\nنسير على هدي الكتاب والسنة.',
      bgColor: Color(0xFF1B6B3A),
    ),
    const OnboardingPage(
      emoji: '🔒',
      title: 'خصوصية وأمان',
      description: 'بياناتك في أمان تام.\nالمرأة تتواصل بإشراف وليّها.\nجميع الملفات مراجعة من قِبل الإدارة.',
      bgColor: Color(0xFF1A4A6B),
    ),
    const OnboardingPage(
      emoji: '🔍',
      title: 'بحث متقدم دقيق',
      description: 'ابحث بمعايير تفصيلية:\nالجنسية، الالتزام الديني، العمر،\nالمستوى التعليمي، والمزيد.',
      bgColor: Color(0xFF6B3A1A),
    ),
    const OnboardingPage(
      emoji: '💞',
      title: 'قصص نجاح حقيقية',
      description: 'آلاف الأزواج السعداء\nبدأت قصة حبهم من هنا.\nانضم إلينا وابدأ رحلتك نحو السعادة.',
      bgColor: Color(0xFF3A1A6B),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: _pages.length,
            onPageChanged: (index) => setState(() => _currentPage = index),
            itemBuilder: (context, index) {
              return _buildPage(_pages[index]);
            },
          ),
          // Dots indicator
          Positioned(
            bottom: 140,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _pages.length,
                (index) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: _currentPage == index ? 24 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _currentPage == index
                        ? Colors.white
                        : Colors.white.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
          // Buttons
          Positioned(
            bottom: 40,
            left: 24,
            right: 24,
            child: Column(
              children: [
                ElevatedButton(
                  onPressed: () {
                    if (_currentPage < _pages.length - 1) {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    } else {
                      context.go('/register');
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: _pages[_currentPage].bgColor,
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(
                    _currentPage < _pages.length - 1 ? 'التالي' : 'ابدأ الآن',
                    style: const TextStyle(
                      fontFamily: 'Tajawal',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text(
                    'لدي حساب بالفعل - تسجيل الدخول',
                    style: TextStyle(
                      fontFamily: 'Tajawal',
                      color: Colors.white,
                      fontSize: 15,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Skip button
          if (_currentPage < _pages.length - 1)
            Positioned(
              top: 60,
              left: 20,
              child: TextButton(
                onPressed: () => context.go('/login'),
                child: const Text(
                  'تخطي',
                  style: TextStyle(color: Colors.white70, fontFamily: 'Tajawal'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPage(OnboardingPage page) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            page.bgColor,
            page.bgColor.withOpacity(0.7),
          ],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Decorative top
            Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withOpacity(0.3),
                  width: 2,
                ),
              ),
              child: Center(
                child: Text(
                  page.emoji,
                  style: const TextStyle(fontSize: 80),
                ),
              ),
            ),
            const SizedBox(height: 48),
            Text(
              page.title,
              style: const TextStyle(
                fontFamily: 'Tajawal',
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Text(
              page.description,
              style: TextStyle(
                fontFamily: 'Tajawal',
                fontSize: 16,
                color: Colors.white.withOpacity(0.85),
                height: 1.8,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}
