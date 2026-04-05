const WEATHER_SEQUENCE = ['Clear', 'Clear', 'Cloudy', 'Rain', 'Fog', 'Storm', 'Rain', 'Clear'];

class SimulationEngine {
  constructor() {
    this.tick = 0;
    this.manualOverride = null;
    this.state = {
      traffic: 0.3,
      weather: 'Clear',
      weatherIndex: 0,
    };
  }

  setOverride(override) {
    this.manualOverride = override;
    // Auto-clear after 60 seconds
    setTimeout(() => { this.manualOverride = null; }, 60000);
  }

  next() {
    this.tick++;

    if (this.manualOverride) {
      if (this.manualOverride.traffic !== undefined) this.state.traffic = this.manualOverride.traffic;
      if (this.manualOverride.weather !== undefined) this.state.weather = this.manualOverride.weather;
      return { ...this.state };
    }

    // Simulate traffic with time-of-day pattern
    const hour = new Date().getHours();
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    const baseTraffic = isPeak ? 0.65 : 0.25;
    const noise = (Math.random() - 0.5) * 0.2;
    this.state.traffic = Math.max(0.05, Math.min(0.95, baseTraffic + noise));

    // Cycle weather every 10 ticks
    if (this.tick % 10 === 0) {
      this.state.weatherIndex = (this.state.weatherIndex + 1) % WEATHER_SEQUENCE.length;
      this.state.weather = WEATHER_SEQUENCE[this.state.weatherIndex];
    }

    return { ...this.state };
  }

  getAlerts(state) {
    const alerts = [];
    const hour = new Date().getHours();

    if (state.weather === 'Storm') alerts.push({ type: 'danger', msg: 'Storm detected on current route — rerouting advised' });
    if (state.weather === 'Rain') alerts.push({ type: 'warning', msg: 'Heavy rain expected — reduced visibility on road routes' });
    if (state.weather === 'Fog') alerts.push({ type: 'warning', msg: 'Dense fog detected — road speed limits in effect' });
    if (state.traffic > 0.75) alerts.push({ type: 'danger', msg: `Severe traffic congestion (${Math.round(state.traffic * 100)}%) — alternate route recommended` });
    else if (state.traffic > 0.55) alerts.push({ type: 'warning', msg: `Moderate traffic (${Math.round(state.traffic * 100)}%) — expect delays` });
    if (hour >= 17 && hour <= 19) alerts.push({ type: 'info', msg: 'Evening peak hours — traffic congestion predicted until 8 PM' });
    if (hour >= 7 && hour <= 9) alerts.push({ type: 'info', msg: 'Morning rush hour — road congestion expected' });

    return alerts;
  }

  getPredictiveInsights(origin, dest) {
    const hour = new Date().getHours();
    const insights = [];
    if (hour < 17) insights.push(`Route ${origin}→${dest} typically congested after 6 PM`);
    if (['Mumbai', 'Delhi', 'Kolkata'].includes(origin)) insights.push(`${origin} corridor has 35% higher delay probability on weekdays`);
    insights.push('Historical data: Train routes 40% more reliable during monsoon season');
    if (hour >= 22 || hour <= 5) insights.push('Night shipments show 20% faster delivery on road routes');
    return insights;
  }
}

module.exports = SimulationEngine;
