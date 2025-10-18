import React, { useState, useEffect } from 'react';
import { Mail, Twitter, Github, MessageSquare } from 'lucide-react';
import systemSettingsAPI from '../../services/systemSettingsAPI';

const Footer = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await systemSettingsAPI.getSettings();
      setSettings(response.data);
    } catch (error) {
      console.error('Error loading footer settings:', error);
      // Use defaults on error
      setSettings({
        companyText: '0xflydev. © 2025',
        footerItems: [],
        socialLinks: { email: '', twitter: '', github: '', discord: '' }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !settings) {
    return null; // Or a thin loading skeleton
  }

  const leftItems = settings.footerItems
    .filter(item => item.position === 'left')
    .sort((a, b) => a.order - b.order);

  const rightItems = settings.footerItems
    .filter(item => item.position === 'right')
    .sort((a, b) => a.order - b.order);

  const socialIcons = [
    { name: 'email', Icon: Mail, link: settings.socialLinks?.email },
    { name: 'twitter', Icon: Twitter, link: settings.socialLinks?.twitter },
    { name: 'github', Icon: Github, link: settings.socialLinks?.github },
    { name: 'discord', Icon: MessageSquare, link: settings.socialLinks?.discord }
  ].filter(item => item.link); // Only show icons with links

  return (
    <footer className="sticky bottom-0 bg-white border-t border-gray-200 py-4 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Section */}
          <div className="flex items-center gap-6 flex-wrap">
            {/* Company Text */}
            <span className="text-sm text-gray-600">
              {settings.companyText}
            </span>

            {/* Left Items */}
            {leftItems.map((item) => (
              <a
                key={item._id}
                href={item.link}
                target={item.link.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {item.content}
              </a>
            ))}
          </div>

          {/* Center/Right Items */}
          <div className="flex items-center gap-6 flex-wrap">
            {/* Right Text Items */}
            {rightItems.filter(item => item.type === 'text').map((item) => (
              <a
                key={item._id}
                href={item.link}
                target={item.link.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {item.content}
              </a>
            ))}

            {/* Social Icons */}
            <div className="flex items-center gap-4 ml-2">
              {socialIcons.map(({ name, Icon, link }) => (
                <a
                  key={name}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-900 transition-colors"
                  aria-label={name}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
