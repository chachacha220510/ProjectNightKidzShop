import { Logger, NotificationTypes } from '@medusajs/framework/types'
import { AbstractNotificationProviderService, MedusaError } from '@medusajs/framework/utils'
import { Resend, CreateEmailOptions } from 'resend'
import { ReactNode } from 'react'
import { generateEmailTemplate } from '../templates'

type InjectedDependencies = {
  logger: Logger
}

interface ResendServiceConfig {
  apiKey: string
  from: string
}

export interface ResendNotificationServiceOptions {
  api_key: string
  from: string
}

type NotificationEmailOptions = {
  subject?: string
  headers?: Record<string, string>
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  tags?: { name: string; value: string }[]
  text?: string
  scheduledAt?: Date
}

/**
 * Service to handle email notifications using the Resend API.
 */
export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "RESEND_NOTIFICATION_SERVICE"
  protected config_: ResendServiceConfig // Configuration for Resend API
  protected logger_: Logger // Logger for error and event logging
  protected resend: Resend // Instance of the Resend API client

  constructor({ logger }: InjectedDependencies, options: ResendNotificationServiceOptions) {
    super()
    this.config_ = {
      apiKey: options.api_key,
      from: options.from
    }
    this.logger_ = logger
    this.resend = new Resend(this.config_.apiKey)
    
    // Log initialization to confirm the service is properly loaded
    this.logger_.info(`ResendNotificationService initialized with sender: ${this.config_.from}`)
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    this.logger_.debug(`Preparing to send notification: ${notification.template} to ${notification.to}`)
    
    if (!notification) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `No notification information provided`)
    }
    if (notification.channel === 'sms') {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `SMS notification not supported`)
    }

    // Generate the email content using the template
    let emailContent: ReactNode

    try {
      this.logger_.debug(`Generating email template for: ${notification.template}`)
      emailContent = generateEmailTemplate(notification.template, notification.data)
      this.logger_.debug(`Email template generated successfully`)
    } catch (error) {
      this.logger_.error(`Failed to generate email template: ${error.message}`, error)
      if (error instanceof MedusaError) {
        throw error // Re-throw MedusaError for invalid template data
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to generate email content for template: ${notification.template}`
      )
    }

    const emailOptions = (notification.data?.emailOptions || {}) as NotificationEmailOptions
    const sender = notification.from?.trim() ?? this.config_.from
    
    this.logger_.debug(`Email options: ${JSON.stringify({
      subject: emailOptions.subject,
      from: sender,
      to: notification.to
    })}`)

    // Compose the message body to send via API to Resend
    const message: CreateEmailOptions = {
      to: notification.to,
      from: sender,
      react: emailContent,
      subject: emailOptions.subject ?? 'You have a new notification',
      headers: emailOptions.headers,
      replyTo: emailOptions.replyTo,
      cc: emailOptions.cc,
      bcc: emailOptions.bcc,
      tags: emailOptions.tags,
      text: emailOptions.text,
      attachments: Array.isArray(notification.attachments)
        ? notification.attachments.map((attachment) => ({
            content: attachment.content,
            filename: attachment.filename,
            content_type: attachment.content_type,
            disposition: attachment.disposition ?? 'attachment',
            id: attachment.id ?? undefined
          }))
        : undefined,
      scheduledAt: emailOptions.scheduledAt
    }

    // Send the email via Resend
    try {
      this.logger_.debug(`Sending email via Resend API...`)
      const response = await this.resend.emails.send(message)
      
      this.logger_.info(
        `Successfully sent "${notification.template}" email to ${notification.to} via Resend. ID: ${response.data?.id}`
      )
      
      return { 
        id: response.data?.id 
      }
    } catch (error) {
      const errorCode = error.code || 'UNKNOWN'
      const errorMessage = error.message || 'Unknown error'
      const responseError = error.response?.body?.errors?.[0]
      
      this.logger_.error(
        `Failed to send email via Resend: ${errorCode} - ${responseError?.message || errorMessage}`,
        error
      )
      
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send "${notification.template}" email to ${notification.to} via Resend: ${errorCode} - ${responseError?.message ?? errorMessage}`
      )
    }
  }
}
