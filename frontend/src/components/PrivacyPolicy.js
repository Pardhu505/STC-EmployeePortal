import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Shield className="h-8 w-8 text-[#225F8B]" />
                    <CardTitle className="text-3xl font-bold text-gray-900">Privacy Policy</CardTitle>
                </div>
                <Link to="/login" className="text-sm text-[#225F8B] hover:underline">Back to Login</Link>
            </div>
            <p className="text-sm text-gray-500 pt-2">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <p>
              Welcome to the Showtime Consulting Employee Portal. We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy outlines how we collect, use, and protect your information.
            </p>

            <h2>1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when you register for and use the portal. This includes:
            </p>
            <ul>
              <li><strong>Personal Identification Information:</strong> Name, email address, employee ID, phone number, date of birth.</li>
              <li><strong>Employment Information:</strong> Designation, department, team, reporting manager.</li>
              <li><strong>Profile Information:</strong> Profile picture, emergency contact information.</li>
              <li><strong>Usage Data:</strong> Login times, IP addresses, and activity within the portal for security and operational purposes.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>
              The information we collect is used for the following internal purposes:
            </p>
            <ul>
              <li>To provide and maintain our portal services.</li>
              <li>To manage your employee account and profile.</li>
              <li>For internal communication, including announcements and direct messaging.</li>
              <li>To manage attendance and generate reports for payroll and HR purposes.</li>
              <li>To facilitate company-related activities such as scheduling meetings.</li>
              <li>To ensure the security of our portal and prevent unauthorized access.</li>
            </ul>

            <h2>3. Information Sharing and Disclosure</h2>
            <p>
              Showtime Consulting does not sell or rent your personal information to third parties. Your information is strictly used for internal company operations. We may share your information only in the following circumstances:
            </p>
            <ul>
              <li>With service providers who perform services on our behalf (e.g., cloud hosting), under strict confidentiality agreements.</li>
              <li>If required by law, such as to comply with a subpoena or similar legal process.</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
              We implement a variety of security measures to maintain the safety of your personal information. However, no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.
            </p>

            <h2>5. Your Rights</h2>
            <p>
              As an employee, you have the right to access and update your personal information through the portal's profile section. If you have any questions about your data or this policy, please contact the HR department.
            </p>

            <h2>6. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and, if the changes are significant, by providing a more prominent notice (such as an announcement on the dashboard).
            </p>

            <h2>7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:hr@showtimeconsulting.in">hr@showtimeconsulting.in</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;