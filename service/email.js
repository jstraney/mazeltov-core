/**
 * Email Service Interface
 * constructor
 * @param object - config
 *   @property
 */

const sendinblueApiEmailService = ( ctx = {} ) => {

  const {
    emailServiceConfig: config = {},
    services: {
      templateService,
    },
  } = ctx;

  const {
    senderEmail: defaultSenderEmail,
    senderName: defaultSenderName,
    replyToName: defaultReplyToName = defaultSenderEmail,
    replyToEmail: defaultReplyToEmail = defaultSenderName,
    sendinblueClient = null,
    logger = global.console,
  } = config;

  [
    [ templateService, 'templateService' ],
    [ defaultSenderEmail, 'senderEmail' ],
    [ defaultSenderName, 'senderName' ],
    [ sendinblueClient, 'sendinblueClient' ],
  ].forEach(([arg, label]) => {
    if (!arg) {
      throw new Error(`${label} is required for sendinblueApiEmailService`);
    }
  });

  const sendEmail = async ( args = {} ) => {

    const {
      senderEmail = defaultSenderEmail,
      senderName = defaultSenderName,
      replyToEmail = defaultReplyToEmail,
      replyToName = defaultReplyToName,
      emailTemplate,
      subject,
      templateLocals = {},
      to = [],
      cc = [],
      bcc = [],
    } = args;

    const html = templateService.render(emailTemplate, {
      ...templateLocals,
    });

    return sendinblueClient.sendEmail({
      data: {
        sender: {
          name: senderName,
          email: senderEmail,
        },
      },
    });

    // TODO: decide on standard response for services

  }

  return {
    sendEmail,
  };

}

// TODO: Implement using nodemailer
const smtpEmailService = ( ctx = {} ) => {

  const {
    emailServiceConfig: config = {},
    services: {
      templateService,
    },
  } = ctx;

  const {
    senderEmail: defaultSenderEmail,
    senderName: defaultSenderName,
    replyToName: defaultReplyToName = defaultSenderEmail,
    replyToEmail: defaultReplyToEmail = defaultSenderName,
    nodemailer = null,
    smtpHost,
    smtpPort = 587,
    useSecureMailTransfer = true,
    smtpUser,
    smtpPassword,
    defaultTemplateLocals = {},
    defaultAttachments = [],
    logger = global.console,
  } = config;

  [
    [ templateService, 'templateService' ],
    [ defaultSenderEmail, 'senderEmail' ],
    [ defaultSenderName, 'senderName' ],
    [ smtpHost, 'smtpHost' ],
    [ smtpUser, 'smtpUser' ],
    [ smtpPassword, 'smtpPassword' ],
    [ nodemailer, 'nodemailer' ],
  ].forEach(([arg, label]) => {
    if (!arg) {
      throw new Error(`${label} is required for smtpEmailService`);
    }
  });

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: useSecureMailTransfer,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  const sendEmail = ( args = {} ) => {

    const {
      attachments = [],
      senderEmail = defaultSenderEmail,
      senderName = defaultSenderName,
      replyToEmail = defaultReplyToEmail,
      replyToName = defaultReplyToName,
      subject,
      emailTemplate,
      templateLocals = {},
      to = [],
      cc = [],
      bcc = [],
    } = args;

    // render html
    const html = templateService.render(emailTemplate, {
      ...defaultTemplateLocals,
      ...templateLocals,
    });

    const mailOptions = {
      attachments: defaultAttachments.concat(attachments),
      from: `"${senderName}" <${senderEmail}>`,
      subject,
      html,
    };

    if (to.length) {
      mailOptions.to = to.join(',');
    }
    if (cc.length) {
      mailOptions.cc = cc.join(',');
    }
    if (bcc.length) {
      mailOptions.bcc = bcc.join(',');
    }

    return transporter.sendMail(mailOptions);

  };

  return {
    sendEmail,
  };

}

// email service that utilizes sendmail transport using nodemailer
const sendmailEmailService = ( ctx = {} ) => {

  const {
    emailServiceConfig: config = {},
    services: {
      templateService,
      settingService: {
        getSettings,
      },
    },
  } = ctx;

  const [
    appHostname,
    appOrgName,
    defaultSenderEmail = `donotreply@${appHostname}`,
    defaultSenderName = appOrgName,
  ] = getSettings([
    'app.hostname',
    'app.orgName',
    'app.defaultEmailSenderEmail',
    'app.defaultEmailSenderName',
  ]);

  const {
    replyToName: defaultReplyToName = defaultSenderEmail,
    replyToEmail: defaultReplyToEmail = defaultSenderName,
    nodemailer = null,
    sendmailPath = '/usr/sbin/sendmail',
    defaultAttachments = [],
    defaultTemplateLocals = {},
    logger = global.console,
  } = config;

  [
    [ templateService, 'templateService' ],
    [ defaultSenderEmail, 'senderEmail' ],
    [ defaultSenderName, 'senderName' ],
    [ nodemailer, 'nodemailer' ],
  ].forEach(([arg, label]) => {
    if (!arg) {
      throw new Error(`${label} is required for sendmailEmailService`);
    }
  });

  const transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: sendmailPath,
  });

  const sendEmail = ( args = {} ) => {

    const {
      attachments = [],
      senderEmail = defaultSenderEmail,
      senderName = defaultSenderName,
      replyToEmail = defaultReplyToEmail,
      replyToName = defaultReplyToName,
      subject,
      emailTemplate,
      templateLocals = {},
      to = [],
      cc = [],
      bcc = [],
    } = args;

    // render html
    const html = templateService.render(emailTemplate, {
      ...defaultTemplateLocals,
      ...templateLocals,
    });

    const mailOptions = {
      attachments: defaultAttachments.concat(attachments),
      from: `"${senderName}" <${senderEmail}>`,
      subject,
      html,
    };

    if (to.length) {
      mailOptions.to = to.join(',');
    }
    if (cc.length) {
      mailOptions.cc = cc.join(',');
    }
    if (bcc.length) {
      mailOptions.bcc = bcc.join(',');
    }

    return transporter.sendMail(mailOptions);

  };

  return {
    sendEmail,
  };

}


/**
 * Generates test accounts with ethereal email great
 * for quick and easy email testing and development.
 */
const etherealEmailService = ( ctx = {} ) => {

  const {
    senderEmail: defaultSenderEmail,
    senderName: defaultSenderName,
    emailServiceConfig: config = {},
    services: {
      templateService,
    },
  } = ctx;

  const {
    nodemailer = null,
    defaultAttachments = [],
    defaultTemplateLocals = {},
    logger = global.console,
  } = config;

  [
    [ defaultSenderEmail, 'defaultSenderEmail' ],
    [ defaultSenderName, 'defaultSenderName' ],
    [ templateService, 'templateService' ],
    [ nodemailer, 'nodemailer' ],
  ].forEach(([arg, label]) => {
    if (!arg) {
      throw new Error(`${label} is required for sendmailEmailService`);
    }
  });

  const testAccount = nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 465,
    secure: true,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  const sendEmail = ( args = {} ) => {

    const {
      attachments = [],
      senderEmail = defaultSenderEmail,
      senderName = defaultSenderName,
      replyToEmail = defaultReplyToEmail,
      replyToName = defaultReplyToName,
      subject,
      emailTemplate,
      templateLocals = {},
      to = [],
      cc = [],
      bcc = [],
    } = args;

    // render html
    const html = templateService.render(emailTemplate, {
      ...defaultTemplateLocals,
      ...templateLocals,
    });

    const mailOptions = {
      attachments: defaultAttachments.concat(attachments),
      from: `"${senderName}" <${senderEmail}>`,
      subject,
      html,
    };

    if (to.length) {
      mailOptions.to = to.join(',');
    }
    if (cc.length) {
      mailOptions.cc = cc.join(',');
    }
    if (bcc.length) {
      mailOptions.bcc = bcc.join(',');
    }

    return transporter.sendMail(mailOptions);

  };

  return {
    sendEmail,
  };

};

// email service that uses RabbitMQ publisher as described in
// this example: https://github.com/nodemailer/nodemailer-amqp-example
// TODO: implement
/*
 * amqpEmailService = ( config = {} ) => {
 *
 *   // ...
 *
 * }
 */

module.exports = ( ctx = {} ) => {

  const {
    emailServiceConfig: {
      type = 'sendmail',
    },
  } = ctx;

  if (!type) {
    return null;
  }

  // TODO: realize that this pattern here could lend itself
  // to using the hookService to allow other modules to register
  // their own service types.
  switch (type) {
    case 'smtp':
      return smtpEmailService(ctx);
    case 'sendinblueApi':
      return sendinblueApiEmailService(ctx);
    case 'sendmail':
      return sendmailEmailService(ctx);
    case 'ethereal':
      return etherealEmailService(ctx);
    default:
      throw new Error('Unknown email service type')
  }

}
