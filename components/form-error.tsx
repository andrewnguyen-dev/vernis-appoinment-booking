import React from 'react'
import { MdError } from "react-icons/md";

type FormErrorProps = {
    message?: string
}

const FormError = ({message}: FormErrorProps) => {
    if (!message) return null
  return (
    <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-destructive">
        <MdError className='w-6 h-6'/>
        {message}
    </div>
  )
}

export default FormError