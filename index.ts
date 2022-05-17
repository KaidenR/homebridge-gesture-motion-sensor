import { Service } from 'homebridge'
import { HomebridgeAPI, AccessoryPlugin } from 'homebridge/lib/api'
import * as http from 'http'

export default (api: HomebridgeAPI) => {
  api.registerAccessory('GestureMotionSensor', GestureMotionSensorAccessory as any)
}

export class GestureMotionSensorAccessory implements AccessoryPlugin {
  private log: any
  private config: GestureMotionSensorConfig
  private api: HomebridgeAPI
  private services: Record<Gesture, Service>
  private name: string
  private lastGesture = Gesture.None
  private server: http.Server

  constructor(log: any, config: GestureMotionSensorConfig, api: HomebridgeAPI) {
    this.log = log
    this.config = config
    this.api = api
    this.name = config.name

    this.services = this.createServices()
    this.server = this.createHttpServer()
  }

  private createServices() {
    const { Service, Characteristic } = this.api.hap
    const gestures = [Gesture.Up, Gesture.Right, Gesture.Down, Gesture.Left]

    return gestures.reduce((services, gesture, idx) => {
      const service = new Service(`${this.config.name} ${gesture} sensor`, `7e760131-9120-4dd4-a76a-a105aabbeb52${idx}`)
      services[gesture] = service

      service.getCharacteristic(Characteristic.MotionDetected)
        .onGet(() => this.lastGesture === gesture)

      return services
    }, {} as Record<Gesture, Service>)
  }

  private createHttpServer() {
    const server = new http.Server(this.handleServerRequest)
    const { name, port } = this.config

    this.api.on('shutdown', () => this.server!.close())
    server.listen(port, () => this.log(`Device '${name}' listening @ http://localhost:${port}`))

    return server
  }

  private handleServerRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const triggeredGesture = Object.values(Gesture).find(g => req.url?.includes(`action=${g}`))
    console.log(`Gesture was triggered: ${triggeredGesture}`)

    if (triggeredGesture) {
      if (this.lastGesture && this.lastGesture !== triggeredGesture)
        this.setMotionDetectedForGesture(this.lastGesture, false)
      this.lastGesture = triggeredGesture
      this.setMotionDetectedForGesture(triggeredGesture, true)
    }

    res.statusCode = 200
    res.end()
  }

  private setMotionDetectedForGesture(gesture: Gesture, isMotionDetected: boolean) {
    const service = this.services[gesture]
    console.log('setting service for', gesture, 'to', isMotionDetected)
    const characteristic = service?.getCharacteristic(this.api.hap.Characteristic.MotionDetected)
    characteristic?.updateValue(isMotionDetected)
  }

  public getServices(): Service[] {
    return Object.values(this.services)
  }
}

enum Gesture {
  None = 'none',
  Up = 'up',
  Right = 'right',
  Down = 'down',
  Left = 'left'
}

type GestureMotionSensorConfig = {
  name: string
  port: number
}
