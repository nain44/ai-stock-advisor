const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

function withOptimizeR8(config) {
  // 1. Modify build.gradle to use optimized Proguard profile
  config = withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        'proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"',
        'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"'
      );
    }
    return modConfig;
  });

  // 2. Modify gradle.properties to enable optimized shrinking
  config = withGradleProperties(config, (modConfig) => {
    const properties = modConfig.modResults;

    // Check if the property already exists to prevent duplicate entries
    const key = 'android.enableR8.optimisedShrinking';
    const index = properties.findIndex((p) => p.type === 'property' && p.key === key);

    if (index !== -1) {
      properties[index].value = 'true';
    } else {
      properties.push({
        type: 'property',
        key: key,
        value: 'true',
      });
    }

    return modConfig;
  });

  return config;
}

module.exports = withOptimizeR8;
