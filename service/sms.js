const sendInBlueApiSMSService = (config = {}) => {

  const {
    sendinblueClient,
    sender: defaultSender,
    logger = global.console,
  } = config;

  const sendSMS = async ( args = {} ) => {

    const {
      sender = defaultSender,
      recipient,
      content,
    } = args;

    return sendinblueClient.sendSMS({
      data: {
        sender,
        recipient,
        content,
      },
    });

  };

  return {
    sendSMS,
  }

};

module.exports = ( config = {} ) => {

  switch (type) {
    case 'sendinblueApi':
    default:
      return sendInBlueApiSMSService(config);
  }
  return
}
