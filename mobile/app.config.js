const baseConfig = require('./app.json').expo;

module.exports = ({ config }) => {
  const mapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const android = {
    ...config.android,
    ...baseConfig.android,
  };

  if (mapsApiKey) {
    android.config = {
      ...config.android?.config,
      ...baseConfig.android?.config,
      googleMaps: {
        apiKey: mapsApiKey,
      },
    };
  }

  return {
    ...config,
    ...baseConfig,
    android,
  };
};
