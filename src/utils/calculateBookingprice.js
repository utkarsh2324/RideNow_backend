export const calculateBookingPrice = (
    startDate,
    endDate,
    pricing
  ) => {
    let totalPrice = 0;
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
  
    while (currentDate <= lastDate) {
      const day = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
  
      if (day === 0 || day === 6) {
        totalPrice += pricing.weekendPrice;
      } else {
        totalPrice += pricing.weekdayPrice;
      }
  
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return totalPrice;
  };