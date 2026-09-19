import { useNavigate } from 'react-router-dom';
import { Button, Typography, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

// legal text — title keys point to i18n; body text is inline English
const SECTIONS: { titleKey: string; content: string | string[] }[] = [
  {
    titleKey: 'terms.section1',
    content: 'Welcome to ailinkcat (the "Platform"), a service for hardware-software integration and theme marketplace. Please read and fully understand these Terms of Service (the "Terms") before using the Platform. By registering, logging in, downloading, or using any software, plugin, or online service provided by the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and all rules, policies, and notices published by the Platform. If you do not agree with any part of these Terms, please stop using the Platform immediately.',
  },
  {
    titleKey: 'terms.section2',
    content: [
      'You agree to provide true, accurate, complete, and lawful registration information as prompted on the registration page, and to keep it up to date. You may not transfer, gift, bequeath, or share your account credentials with others.',
      'You are fully responsible for all activities under your account, including but not limited to theme uploads, downloads, comments, and device-link bindings. If your account is compromised due to your own disclosure or mishandling, you bear the resulting losses.',
      '[Root and Elevated Privileges] If you install this Platform\'s software on a device that has been rooted, jailbroken, or granted elevated system privileges, you acknowledge and accept the potential risks to system stability, security, or hardware longevity that such modifications may cause.',
    ],
  },
  {
    titleKey: 'terms.section3',
    content: [
      'You agree to comply with applicable laws and regulations as well as all Platform rules. You must not use the Platform for any illegal activity, including but not limited to distributing pornographic, violent, gambling, fraud, infringement, or subversive content.',
      'You must not use the Platform to harm network security, disrupt normal operations, maliciously consume resources, scrape data unlawfully, or interfere with WebSocket-based multi-device communication.',
      '[Third-Party Authorization] When uploading or sharing themes, wallpapers, or custom scripts, you must own the copyright or have obtained sufficient authorization from the rights holder. Uploading content containing malicious code, trojans, viruses, or content that infringes on others\' lawful rights is strictly prohibited.',
    ],
  },
  {
    titleKey: 'terms.section4',
    content: [
      'The Platform is a third-party theme-sharing and technical-exchange community. The Platform does not conduct substantive review of the legality or security of all user-uploaded themes, configurations, or third-party resources.',
      '[Safe Harbor] If a rights holder believes that any theme or content on the Platform infringes their intellectual property or other lawful rights, they may send a written notice to the Platform. Upon receiving a valid notice meeting legal requirements, the Platform has the right to remove the content or take other measures as required by law, without liability for any breach or damages.',
      'You grant the Platform, within the scope of its operations, the right to display, store, distribute, and perform necessary technical processing on the themes you upload.',
    ],
  },
  {
    titleKey: 'terms.section5',
    content: [
      'The Platform offers membership plans, premium features, and points-redemption items that are virtual digital goods. Please carefully review the plan details, pricing, and validity period before purchase.',
      '[No-Refund Policy] Virtual services are considered delivered upon purchase. Except where required by law or explicitly promised by the Platform, fees paid are non-refundable.',
      '[Minor Protection] If you are a minor, please read these Terms and make purchases under the supervision of a legal guardian. Purchases made without guardian consent may be revoked by the guardian in accordance with the law.',
      'Membership services expire automatically upon their end date. The Platform is not liable for interruption of premium services due to non-renewal.',
    ],
  },
  {
    titleKey: 'terms.section6',
    content: [
      'The Platform values and protects your personal information in accordance with applicable laws and the privacy policy, collecting, using, and storing only necessary data.',
      '[LAN and Device-Link Data] To enable hardware monitoring (CPU/memory), music-media sync, and WebSocket-based state integration between the PC and mobile clients, relevant runtime data is transmitted only within your local network or authorized channels. The Platform does not exfiltrate your private files.',
      'You are responsible for safeguarding your authentication credentials. The Platform is not liable for data breaches caused by insufficient security on your own devices.',
    ],
  },
  {
    titleKey: 'terms.section7',
    content: [
      '[Hardware-Software Integration Disclaimer] Multi-device coordination, hardware monitoring, and automation features depend on the operating system, network environment, and third-party software (e.g., local media players). The Platform is not liable for control-command failures, data-sync delays, or wake-screen failures caused by user device/phone permission settings, antivirus interference, third-party software updates, LAN fluctuations, or hardware aging.',
      '[Root and Battery Management Disclaimer] If you use this Platform together with root privileges for persistent keep-alive, charge-threshold management, or similar power-user features, you assume all associated risks. The Platform is not responsible for hardware damage, battery swelling, or device failure caused by prolonged operation, natural battery wear, or kernel-script anomalies.',
      'The Platform is not liable for service interruptions or data loss caused by force majeure, including but not limited to natural disasters, widespread network outages, carrier disconnections, government actions, or policy changes. The Platform will make reasonable efforts to restore service but is not liable for resulting economic losses.',
    ],
  },
  {
    titleKey: 'terms.section8',
    content: [
      'The Platform reserves the right to revise these Terms from time to time in response to legal, business, or technical changes.',
      'Revised Terms will be announced in a prominent location on the Platform. If you continue using the Platform after the revised Terms take effect, you are deemed to have accepted them. If you disagree, you may stop using the Platform and cancel your account.',
    ],
  },
];

export default function Terms() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="auth-background" style={{ height: '100vh', background: '#f5f7fa', padding: '40px 16px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          {t('terms.back')}
        </Button>
        <div style={{ background: '#fff', borderRadius: 8, padding: '32px 40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: 4 }}>{t('terms.title')}</Title>
          <div style={{ textAlign: 'center', color: '#999', fontSize: 13, marginBottom: 24 }}>
            <Text type="secondary">{t('terms.updatedAt')} &nbsp;·&nbsp; {t('terms.effectiveAt')}</Text>
          </div>
          {SECTIONS.map((sec, idx) => (
            <div key={idx} style={{ marginBottom: 24 }}>
              <Title level={4} style={{ marginBottom: 8 }}>{t(sec.titleKey)}</Title>
              {Array.isArray(sec.content) ? (
                sec.content.map((p, i) => (
                  <Paragraph key={i} style={{ fontSize: 14, lineHeight: 1.8, color: '#444', marginBottom: 8, textIndent: '2em' }}>
                    {p}
                  </Paragraph>
                ))
              ) : (
                <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: '#444', textIndent: '2em' }}>
                  {sec.content}
                </Paragraph>
              )}
            </div>
          ))}
          <Divider />
          <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
            {t('terms.footer')}
          </div>
        </div>
      </div>
    </div>
  );
}
