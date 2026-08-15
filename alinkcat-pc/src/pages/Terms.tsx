import { useNavigate } from 'react-router-dom';
import { Button, Typography, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

// 法律正文保留中文原文，标题通过 titleKey 指向 i18n 翻译
const SECTIONS: { titleKey: string; content: string | string[] }[] = [
  {
    titleKey: 'terms.section1',
    content: '欢迎您使用艾联猫（以下简称"本平台"）提供的软硬件联动及主题包市场服务。请您在使用本平台前仔细阅读并充分理解本《服务条款》（以下简称"本条款"）。当您注册、登录、下载或使用本平台的任何软件、插件及在线服务时，即表示您已阅读、理解并同意接受本条款及本平台公布的各项规则、政策、公告等内容的约束。若您不同意本条款的任何内容，请您立即停止使用本平台服务。',
  },
  {
    titleKey: 'terms.section2',
    content: [
      '您应按照本平台注册页面的提示提供真实、准确、完整、合法有效的注册资料，并应保证其及时更新。您设置的账号、密码不得以任何方式转让、赠予、继承或分享给他人使用。',
      '您应对您账号项下的所有行为（包括但不限于主题上传、下载、评论、设备联动绑定等）负全部责任。如因您主动泄露、保管不当导致账号被盗用，由此产生的损失由您自行承担。',
      '【Root与高级权限提示】 若您将本平台软件安装于经过 Root（越狱）或获取高级系统权限的设备上，您应完全知晓并自行承担该等操作可能带来的系统稳定性风险、安全漏洞或硬件寿命损耗。',
    ],
  },
  {
    titleKey: 'terms.section3',
    content: [
      '您承诺遵守国家法律法规及本平台各项规则，不得利用本平台从事任何违法违规活动，包括但不限于传播色情、暴力、赌博、诈骗、侵权、反动等信息。',
      '您不得利用本平台从事危害网络安全、破坏平台正常运营、恶意占用资源、非法抓取数据或干扰多端 WebSocket 正常通信的行为。',
      '【第三方授权保证】 用户通过本平台上传、分享的主题包、壁纸或自定义脚本，应为您合法拥有版权或已获得权利人充分授权。严禁上传包含恶意代码、木马、病毒或侵犯他人合法权益的内容。',
    ],
  },
  {
    titleKey: 'terms.section4',
    content: [
      '本平台是一个第三方主题包分享与技术交流平台。本平台不对用户上传的所有主题包、个性化配置及第三方资源的合法性、安全性做实质性审查。',
      '【避风港声明】 如权利人认为本平台上的某个主题包或内容侵犯其知识产权或其他合法权益，可向本平台发出书面权利通知。本平台在收到符合法律规定的有效通知后，有权依法采取断开链接、下架作品等措施，不承担因此产生的任何违约或赔偿责任。',
      '您授权本平台在运营范围内对您上传的主题包进行展示、存储、分发及必要的技术处理。',
    ],
  },
  {
    titleKey: 'terms.section5',
    content: [
      '本平台提供的会员套餐、高级功能或积分兑换等属于虚拟数字商品。您在购买前应仔细核对套餐内容、价格及有效期。',
      '【不支持无理由退款说明】 虚拟服务一经购买即视为服务交付成立，除法律法规另有规定或平台明确承诺外，已支付的费用原则上不予退还。',
      '【未成年人消费保护】 若您为未成年人，请在法定监护人的陪同下阅读本条款并完成付费购买；未经监护人同意的消费，监护人有权依法主张撤销。',
      '会员服务到期后自动失效，平台不承担因到期未续费导致的增值服务中断损失。',
    ],
  },
  {
    titleKey: 'terms.section6',
    content: [
      '本平台重视并依法保护您的个人信息安全，将按照相关法律法规及隐私政策收集、使用和存储必要的数据。',
      '【局域网与设备联动数据说明】 为实现 PC 端与移动端的硬件监控（CPU/内存）、音乐媒体同步及 WebSocket 状态互联，相关运行数据仅在您的局域网或授权通道内传输，本平台不会恶意窃取您的私密文件。',
      '您应妥善保管用于身份验证的凭证，本平台不对因您自身终端安全防护不足导致的数据泄露承担责任。',
    ],
  },
  {
    titleKey: 'terms.section7',
    content: [
      '【软硬件联动及环境免责】 本平台提供的多端协同、硬件监控及自动控制功能依赖于特定的操作系统、网络环境及第三方软件（如本地播放器等）。因用户电脑/手机权限设置、杀毒软件拦截、第三方软件版本更新、局域网网络波动或硬件老化等原因导致控制指令失效、数据同步延迟、息屏唤醒失败的，本平台不承担任何法律责任。',
      '【 Root 与电池管理免责】 若您使用本平台配合 Root 权限进行设备常驻保活、充电阈值管理（如限制充放电）等极客功能，您应自行评估潜在风险。因设备长时间运行、电池自然损耗或内核脚本异常导致的硬件损坏、电池鼓包或设备故障，本平台概不负责。',
      '因不可抗力（包括但不限于自然灾害、大面积网络故障、运营商断网、政府行为、政策调整等）导致本平台服务中断或数据丢失的，本平台将尽合理努力恢复，但不承担由此产生的经济损失。',
    ],
  },
  {
    titleKey: 'terms.section8',
    content: [
      '本平台有权根据法律法规的变化、业务发展需求或技术迭代，对本条款进行不定期修订。',
      '修改后的条款将在平台显著位置予以公告。若您在公告发布并生效后继续使用本平台服务，即视为您已接受修订后的条款；如您不同意修订内容，您有权主动停止使用本平台服务并注销账号。',
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