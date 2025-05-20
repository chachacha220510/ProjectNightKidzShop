import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  console.log('Order placed event received with ID:', data.id)
  
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  
  try {
    const order = await orderModuleService.retrieveOrder(data.id, { 
      relations: ['items', 'summary', 'shipping_address'] 
    })
    console.log('Order retrieved successfully:', order.id)
    
    if (!order.email) {
      console.error('No email address found on order:', order.id)
      return
    }
    
    const shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(order.shipping_address.id)
    console.log('Shipping address retrieved successfully')

    // Ensure all required data is available
    if (!order.items || !order.summary || !shippingAddress) {
      console.error('Missing required order data:', {
        hasItems: !!order.items,
        hasSummary: !!order.summary,
        hasShippingAddress: !!shippingAddress
      })
      return
    }

    console.log('Sending order confirmation email to:', order.email)
    const result = await notificationModuleService.createNotifications([{
      to: order.email,
      channel: 'email',
      template: EmailTemplates.ORDER_PLACED,
      data: {
        emailOptions: {
          replyTo: process.env.RESEND_FROM_EMAIL || 'support@nightkidz.com',
          subject: `Your NightKidz order #${order.display_id} has been confirmed`
        },
        order,
        shippingAddress,
        preview: 'Thank you for your order!'
      }
    }])
    
    console.log('Order confirmation email sent successfully:', result)
  } catch (error) {
    console.error('Error sending order confirmation notification:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}
