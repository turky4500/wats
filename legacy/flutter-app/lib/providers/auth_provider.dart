import 'package:flutter/material.dart';
import '../models/user_model.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.unauthenticated;
  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  AuthStatus get status => _status;
  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  // تسجيل الدخول
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(const Duration(seconds: 2)); // محاكاة API call
      
      // هنا سيتم الاتصال بـ Firebase Authentication
      // final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
      //   email: email, password: password);
      
      // بيانات تجريبية
      _currentUser = UserModel(
        id: 'user_001',
        username: 'أحمد المسلم',
        email: email,
        gender: 'male',
        age: 28,
        nationality: 'السعودية',
        country: 'السعودية',
        city: 'الرياض',
        maritalStatus: 'single',
        religiousLevel: 'committed',
        beard: 'yes',
        height: 175,
        weight: 75,
        skinColor: 'medium',
        education: 'بكالوريوس',
        job: 'مهندس',
        hasChildren: false,
        childrenCount: 0,
        acceptPolygamy: false,
        wantsPolygamy: false,
        tribe: '',
        bio: 'أبحث عن زوجة صالحة ملتزمة بدينها',
        photoVisible: true,
        seekingDescription: 'أبحث عن زوجة ملتزمة بالدين والأخلاق',
        hobbies: ['القراءة', 'الرياضة'],
        isOnline: true,
        lastSeen: DateTime.now(),
        createdAt: DateTime.now(),
        isVerified: true,
        isPremium: false,
        premiumType: 'free',
        isApproved: true,
        isActive: true,
      );
      
      _status = AuthStatus.authenticated;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'خطأ في تسجيل الدخول: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // إنشاء حساب جديد
  Future<bool> register({
    required String email,
    required String password,
    required String username,
    required String gender,
    required int age,
    required String nationality,
    required String country,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(const Duration(seconds: 2));
      
      // هنا سيتم الاتصال بـ Firebase
      // final credential = await FirebaseAuth.instance.createUserWithEmailAndPassword(
      //   email: email, password: password);
      
      _status = AuthStatus.authenticated;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'خطأ في إنشاء الحساب: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // تسجيل الخروج
  Future<void> logout() async {
    // await FirebaseAuth.instance.signOut();
    _currentUser = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
