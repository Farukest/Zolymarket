const mongoose = require('mongoose');

const footerItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'icon'],
    required: true
  },
  content: {
    type: String,
    required: true,
    description: 'Text content or icon name'
  },
  link: {
    type: String,
    required: true
  },
  position: {
    type: String,
    enum: ['left', 'right'],
    required: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  }
}, { _id: true });

const systemSettingsSchema = new mongoose.Schema({
  // Company text for left side of footer
  companyText: {
    type: String,
    default: '0xflydev. © 2025'
  },

  // Dynamic footer items (Privacy, Terms, etc.)
  footerItems: {
    type: [footerItemSchema],
    default: []
  },

  // Social media links (right side)
  socialLinks: {
    email: {
      type: String,
      default: ''
    },
    twitter: {
      type: String,
      default: ''
    },
    github: {
      type: String,
      default: ''
    },
    discord: {
      type: String,
      default: ''
    }
  },

  // Singleton pattern - only one settings document
  _id: {
    type: String,
    default: 'system-settings'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findById('system-settings');
  if (!settings) {
    settings = await this.create({ _id: 'system-settings' });
  }
  return settings;
};

systemSettingsSchema.statics.updateSettings = async function(updates) {
  const settings = await this.findByIdAndUpdate(
    'system-settings',
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  );
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
