import { TemplateRenderer } from 'ductus'
import { render } from '@tsomaiatech/moxite'

const TemplateRenderer: TemplateRenderer = (template, context) => {
  return render(template, context)
}

export default TemplateRenderer
