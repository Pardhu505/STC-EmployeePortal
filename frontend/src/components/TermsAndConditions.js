import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-[#225F8B]" />
                    <CardTitle className="text-3xl font-bold text-gray-900">Terms and Conditions</CardTitle>
                </div>
                <Link to="/login" className="text-sm text-[#225F8B] hover:underline">Back to Login</Link>
            </div>
            <p className="text-sm text-gray-500 pt-2">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <p>
              Please read these Terms and Conditions ("Terms") carefully before using the Showtime Consulting Employee Portal (the "Service") operated by Showtime Consulting ("us", "we", or "our").
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service. This portal is for the exclusive use of authorized Showtime Consulting employees.
            </p>

            <h2>2. Accounts</h2>
            <p>
              When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
            </p>

            <h2>3. Use of the Portal</h2>
            <p>
              The portal is intended for business-related purposes, including but not limited to:
            </p>
            <ul>
              <li>Accessing company resources and portals.</li>
              <li>Receiving official company announcements.</li>
              <li>Communicating with colleagues for work-related matters.</li>
              <li>Managing your personal and employment information.</li>
              <li>Tracking attendance and accessing payslips.</li>
            </ul>
            <p>
              You agree not to use the portal for any unlawful purpose or any purpose prohibited under this clause. You agree not to use the Service in any way that could damage the portal, the services, or the general business of Showtime Consulting.
            </p>

            <h2>4. Intellectual Property</h2>
            <p>
              The Service and its original content (excluding content provided by users), features, and functionality are and will remain the exclusive property of Showtime Consulting and its licensors.
            </p>

            <h2>5. Termination</h2>
            <p>
              We may terminate or suspend your access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
            </p>

            <h2>6. Limitation of Liability</h2>
            <p>
              In no event shall Showtime Consulting, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>

            <h2>7. Changes</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.
            </p>

            <h2>8. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at: <a href="mailto:hr@showtimeconsulting.in">hr@showtimeconsulting.in</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsAndConditions;