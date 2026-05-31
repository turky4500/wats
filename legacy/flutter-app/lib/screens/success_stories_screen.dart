import 'package:flutter/material.dart';
import '../utils/app_theme.dart';

class SuccessStory {
  final String names;
  final String countries;
  final String story;
  final String date;
  final String emoji;

  const SuccessStory({
    required this.names,
    required this.countries,
    required this.story,
    required this.date,
    required this.emoji,
  });
}

class SuccessStoriesScreen extends StatelessWidget {
  const SuccessStoriesScreen({super.key});

  static const List<SuccessStory> _stories = [
    SuccessStory(
      names: 'أحمد وأمل',
      countries: 'السعودية & مصر',
      story: 'الحمد لله، تعارفنا عبر التطبيق وكان التواصل محتشماً من البداية. بعد أشهر قليلة تم الزواج بحمد الله وكنا سعداء جداً. جزاكم الله خيراً على هذا التطبيق المبارك.',
      date: 'يناير 2025',
      emoji: '💍',
    ),
    SuccessStory(
      names: 'محمد وهدى',
      countries: 'الكويت & الأردن',
      story: 'بداية رحلتنا كانت من هنا. كل شيء تم بشكل شرعي سليم، ولي الأمر كان حاضراً في كل خطوة. الآن نحن زوجان سعيدان بفضل الله ثم هذا التطبيق.',
      date: 'مارس 2025',
      emoji: '🌸',
    ),
    SuccessStory(
      names: 'عمر ونور',
      countries: 'الإمارات & المغرب',
      story: 'كنت متشككاً في البداية لكن الانضباط والجدية في التطبيق أعجبني كثيراً. لا توجد صور مبتذلة ولا محادثات غير لائقة. الحمد لله تزوجنا وأنجبنا.',
      date: 'مايو 2025',
      emoji: '☪️',
    ),
    SuccessStory(
      names: 'يوسف وريم',
      countries: 'قطر & السعودية',
      story: 'رأيت ملفها في التطبيق فأعجبني الوصف الصادق والالتزام الديني. تواصلت وبعد موافقة وليّها تم الاتفاق والزواج. الآن بيتنا مليء بالسعادة والمحبة.',
      date: 'أغسطس 2025',
      emoji: '🤲',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('قصص النجاح')),
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
                  const Text('💞', style: TextStyle(fontSize: 50)),
                  const SizedBox(height: 12),
                  const Text(
                    '450,000+ قصة نجاح',
                    style: TextStyle(fontFamily: 'Tajawal', fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'هذه بعض قصص أزواج سعداء وجدوا بعضهم عبر نِكاح',
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
                  // Your story CTA
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppTheme.accentGold.withOpacity(0.1), AppTheme.lightGold],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.accentGold.withOpacity(0.4)),
                    ),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('لديك قصة نجاح؟', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark, fontSize: 15)),
                              SizedBox(height: 4),
                              Text('شارك قصتك لتشجيع الآخرين', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 13)),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () {},
                          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentGold),
                          child: const Text('شارك', style: TextStyle(fontFamily: 'Tajawal')),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Stories
                  ..._stories.map((story) => _buildStoryCard(story)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStoryCard(SuccessStory story) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(child: Text(story.emoji, style: const TextStyle(fontSize: 24))),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(story.names, style: const TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textDark)),
                    Text(story.countries, style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 13)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(story.date, style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.primaryGreen, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppTheme.dividerColor),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('"', style: TextStyle(fontSize: 40, color: AppTheme.accentGold, height: 0.8)),
              Expanded(
                child: Text(
                  story.story,
                  style: const TextStyle(fontFamily: 'Tajawal', height: 1.7, color: AppTheme.textDark, fontSize: 14),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Icon(Icons.favorite, color: Colors.red, size: 16),
              const SizedBox(width: 4),
              const Text('أعجبني', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 13)),
            ],
          ),
        ],
      ),
    );
  }
}
