import 'package:flutter/material.dart';
import '../models/user_model.dart';

class SearchFilters {
  String gender;
  int minAge;
  int maxAge;
  String nationality;
  String country;
  String maritalStatus;
  String religiousLevel;
  String sortBy;

  SearchFilters({
    this.gender = 'female',
    this.minAge = 18,
    this.maxAge = 60,
    this.nationality = '',
    this.country = '',
    this.maritalStatus = '',
    this.religiousLevel = '',
    this.sortBy = 'lastSeen',
  });
}

class SearchProvider extends ChangeNotifier {
  List<UserModel> _results = [];
  bool _isLoading = false;
  SearchFilters _filters = SearchFilters();
  
  List<UserModel> get results => _results;
  bool get isLoading => _isLoading;
  SearchFilters get filters => _filters;

  Future<void> search() async {
    _isLoading = true;
    notifyListeners();

    await Future.delayed(const Duration(seconds: 1));

    // بيانات تجريبية - سيتم استبدالها بـ Firestore queries
    _results = _getDemoUsers();
    _isLoading = false;
    notifyListeners();
  }

  void updateFilters(SearchFilters newFilters) {
    _filters = newFilters;
    notifyListeners();
  }

  List<UserModel> _getDemoUsers() {
    return [
      UserModel(
        id: 'u1',
        username: 'أم عبدالله',
        email: '',
        gender: 'female',
        age: 25,
        nationality: 'السعودية',
        country: 'السعودية',
        city: 'جدة',
        maritalStatus: 'single',
        religiousLevel: 'committed',
        hijab: 'hijab',
        height: 160,
        weight: 58,
        skinColor: 'fair',
        education: 'بكالوريوس',
        job: 'معلمة',
        hasChildren: false,
        childrenCount: 0,
        acceptPolygamy: false,
        wantsPolygamy: false,
        tribe: 'قريش',
        bio: 'أبحث عن زوج صالح ملتزم بدينه وأخلاقه',
        photoVisible: false,
        seekingDescription: 'زوج ملتزم ومستقر',
        hobbies: ['القراءة', 'الطبخ'],
        isOnline: true,
        lastSeen: DateTime.now(),
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
        isVerified: true,
        isPremium: false,
        premiumType: 'free',
        isApproved: true,
        isActive: true,
        guardianName: 'عبدالله محمد',
        guardianPhone: '+966501234567',
        guardianRelation: 'أب',
      ),
      UserModel(
        id: 'u2',
        username: 'هدى الكريم',
        email: '',
        gender: 'female',
        age: 28,
        nationality: 'مصر',
        country: 'الإمارات',
        city: 'دبي',
        maritalStatus: 'divorced',
        religiousLevel: 'committed',
        hijab: 'niqab',
        height: 163,
        weight: 62,
        skinColor: 'medium',
        education: 'ماجستير',
        job: 'دكتورة',
        hasChildren: false,
        childrenCount: 0,
        acceptPolygamy: false,
        wantsPolygamy: false,
        tribe: '',
        bio: 'مطلقة بدون أطفال، أبحث عن بداية جديدة مع زوج صالح',
        photoVisible: true,
        seekingDescription: 'زوج مستقر وناضج',
        hobbies: ['السفر', 'القراءة', 'الطبخ'],
        isOnline: false,
        lastSeen: DateTime.now().subtract(const Duration(hours: 2)),
        createdAt: DateTime.now().subtract(const Duration(days: 15)),
        isVerified: true,
        isPremium: true,
        premiumType: 'gold',
        premiumExpiry: DateTime.now().add(const Duration(days: 30)),
        isApproved: true,
        isActive: true,
        guardianName: 'كريم أحمد',
        guardianPhone: '+971501234567',
        guardianRelation: 'أخ',
      ),
      UserModel(
        id: 'u3',
        username: 'نور الهدى',
        email: '',
        gender: 'female',
        age: 22,
        nationality: 'الكويت',
        country: 'الكويت',
        city: 'الكويت',
        maritalStatus: 'single',
        religiousLevel: 'moderate',
        hijab: 'hijab',
        height: 158,
        weight: 55,
        skinColor: 'fair',
        education: 'بكالوريوس',
        job: 'طالبة',
        hasChildren: false,
        childrenCount: 0,
        acceptPolygamy: false,
        wantsPolygamy: false,
        tribe: '',
        bio: 'طالبة جامعية تبحث عن الزواج بعد التخرج',
        photoVisible: false,
        seekingDescription: 'زوج شاب ملتزم',
        hobbies: ['الرسم', 'القراءة'],
        isOnline: true,
        lastSeen: DateTime.now(),
        createdAt: DateTime.now().subtract(const Duration(days: 5)),
        isVerified: false,
        isPremium: false,
        premiumType: 'free',
        isApproved: true,
        isActive: true,
      ),
    ];
  }
}
